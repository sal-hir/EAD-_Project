# SwiftDrop — authentication and merchant onboarding

The existing React 18/Vite/Tailwind interface now uses a Java 21 / Spring Boot
3.5.16 Auth Service. Customer registration, password login, short-lived JWTs,
current-user verification and role authorization are implemented. Google OIDC
is optional. Password recovery and independent Merchant Service application/review
workflows are implemented. Parcel, courier, delivery orders and notification events
remain future work; their UI routes retain explicit coming-soon states.
Original dashboard components are preserved for the next migration.

## Run with Docker Compose (recommended)

Install Docker with its Linux engine running. From the repository root:

```powershell
# Fresh checkout only; keep an existing configured .env.
Copy-Item .env.example .env
# Set Neon JDBC URLs, AUTH_DB_PASSWORD and a random JWT_SECRET.
# Optional: set Google credentials described below.
docker compose up --build
```

Open http://localhost:3000. The API listens at http://localhost:4000.
Register a customer account; no demo accounts or default passwords are seeded.
Check health at http://localhost:4000/actuator/health/readiness.
Compose connects to Neon without starting a local PostgreSQL container. Auth owns
only the auth schema inside neondb. Existing public/Prisma tables and old local
data volumes are neither migrated nor deleted. Never use
`docker compose down -v` if you need to preserve data.

## Run Java and React directly

Requires Java 21, Maven 3.9+, Node 22.12+ and access to Neon. The local .env is
configured for the supplied database. On a fresh checkout, copy .env.example
and fill in your own connection settings. No local PostgreSQL or Docker database
container is needed.

In a PowerShell terminal at the repository root, load .env without executing it:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^([A-Z][A-Z0-9_]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
  }
}
mvn -f backend/auth-service/pom.xml spring-boot:run
```

In another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Vite defaults to http://localhost:3000 and the API to http://localhost:4000.
For a remote API, put VITE_API_URL in frontend/.env.local and rebuild.
FRONTEND_URL must exactly match the browser origin for CORS. Use HTTPS and set
COOKIE_SECURE=true in hosted environments. Spring Boot does not load root .env
on its own; Compose loads it, or use the PowerShell commands above.

## Neon database configuration

Credentials belong only in the ignored root .env file or deployment Secrets.
AUTH_DB_URL uses Neon's pooled endpoint for application traffic.
AUTH_MIGRATION_DB_URL uses the direct endpoint for Flyway, targeting the same
database. AUTH_DB_USER and AUTH_DB_PASSWORD are separate from these URLs.

Use jdbc:postgresql://HOST/neondb?sslmode=require&channelBinding=require.
The JDBC option is channelBinding (camel case), rather than psql's channel_binding.
The direct hostname is the pooled hostname with -pooler removed. Keep TLS and
channel binding enabled. See [Neon pooling documentation](https://neon.com/docs/connect/connection-pooling).

Flyway creates/version-controls only the auth schema. Hibernate and Spring Session
use explicitly qualified auth tables, avoiding connection-level search paths
through the pooler. Existing non-empty auth schemas without Flyway history cause
startup to fail safely instead of being overwritten.

## Authentication contracts

| Method | Path | Behavior |
| --- | --- | --- |
| POST | /api/v1/auth/register | Customer signup; optional role must be CUSTOMER |
| POST | /api/v1/auth/login | Email/password → token and safe user |
| GET | /api/v1/auth/me | Bearer token → current safe user |
| GET | /api/v1/auth/admin/me | Current identity, restricted to ADMIN/DISPATCHER |
| GET | /api/v1/auth/providers | Whether Google login is configured |
| GET | /oauth2/authorization/google?challenge=… | Start Google via the UI's browser verifier |
| POST | /api/v1/auth/oauth/exchange | Single-use code + verifier → token and safe user |

Registration body: `{ "name": "Kamal Perera", "email": "kamal@example.lk",
"password": "Customer@123!", "phone": "+94 77 123 4567" }`.
Name and email are required; phone is optional. Passwords must contain 8–72
printable ASCII characters. Unknown request properties are rejected. Emails are
stored lowercase. Public signup rejects MERCHANT and all privileged roles.

Success responses use `{ "success": true, "data": ... }`.
Login data contains token, tokenType, expiresIn (seconds), expiresAt, user and role.
Errors use `{ "success": false, "status": 400, "message": "Invalid request",
"errors": { "email": "must be a well-formed email address" }, "timestamp": ... }`.
Duplicate emails return 409; invalid login/token 401; insufficient permissions 403.
User responses never include password hashes or Google identifiers.

Access JWTs live only in React memory and expire after 15 minutes. The browser
restores authentication after reload using an HttpOnly, host-only refresh cookie
(`swiftdrop_refresh`, SameSite=Lax, Path=/api/v1/auth). Refresh sessions have a
fixed seven-day lifetime. Each refresh rotates the opaque token; PostgreSQL stores
only SHA-256 hashes. Reusing a consumed token revokes its entire session family.
Logout revokes that family and clears the cookie. Browser JWTs include a session
identifier, checked on every protected request, so logout/replay also invalidates
copied access tokens immediately. Bare API login without the browser session
header retains expiry-based logout behavior; sensitive identity changes also
invalidate these tokens through the authentication version.

The React session client sends credentials and `X-SwiftDrop-CSRF: 1` on login,
OAuth exchange, `POST /api/v1/auth/refresh` and `POST /api/v1/auth/logout`.
Browser session mutations require that header and the exact allowed frontend
Origin; credentialed CORS permits only FRONTEND_URL. Registration is unchanged.
Refresh returns the usual login data; logout returns 204. React verifies `/auth/me`,
refreshes five seconds before expiry and retries a failed authorized API call once.
Cookie mutations are serialized within a tab and across tabs with Web Locks when
supported. BroadcastChannel propagates login/logout without sharing tokens.
Logout failures display an error and retain identity so revocation can be retried.
Expired session families and their token hashes are removed hourly.

For HTTPS deployment set COOKIE_SECURE=true; localhost HTTP requires false.
Keep the frontend and API on the same site (for example app.example.com and
api.example.com), use exact FRONTEND_URL, and register the HTTPS Google callback.
Do not put Google secrets or JWT_SECRET in frontend VITE variables. Access and
refresh tokens are never stored in localStorage/sessionStorage or callback URLs.

## Administrator bootstrap and identity management

All five roles share `/api/v1/auth/login`, `/me`, refresh and logout. Public
registration creates CUSTOMER only. MERCHANT, COURIER and DISPATCHER identities
are provisioned by ADMIN. A merchant identity does not represent business approval;
merchant business approval is separately enforced by Merchant Service.

First administrator setup is an opt-in local console process, disabled by default.
Stop the running Auth Service first, package it, then run from its directory:

```powershell
cd backend/auth-service
mvn -DskipTests package
java -jar target/auth-service-0.1.0.jar --app.bootstrap.enabled=true --server.address=127.0.0.1
```

Enter name, email and a private password at the terminal prompts. Password input is
hidden; no default password or password argument exists. Use 8-72 printable ASCII
characters. The service stops after setup; restart normally with
`mvn spring-boot:run`. A real interactive console is required (not redirected stdin).
A database guard serializes bootstrap; it cannot overwrite/promote an existing
identity, run when any ADMIN exists, or run again after successful bootstrap.
No administrator REST bootstrap endpoint exists. Do not enable the flag for normal
startup or deployment. Existing administrators should use their existing login.

ADMIN opens **User accounts** (`/admin/users`) to provision identities, search users,
change permitted roles/status, inspect audit events and reissue activation links.
The API returns a single-use 30-minute activation link to the authenticated ADMIN,
with `Cache-Control: no-store`. Share it privately with the intended recipient;
it is shown transiently and never emailed or logged by this implementation.
The recipient opens `/activate#code=...`, chooses their own password, then signs in.
Only the code hash is stored. Reissuing invalidates the previous link. Inactive
accounts cannot activate; activate the identity and issue a new link first.
Existing credentialed accounts cannot use this mechanism to reset a password.
Self-service password recovery is a separate flow described below; activation links
remain restricted to credential-free identities.

Management accepts only explicit DTO fields. Administrators cannot modify themselves,
create additional ADMIN identities, or change any ADMIN identity through these APIs.
This protects the final administrator. Permitted role assignments are MERCHANT,
COURIER and DISPATCHER. Sensitive changes record actor, target, action and time in
`auth.identity_audit`. Role/status changes revoke every refresh family, pending OAuth
exchange/identity action and increment an authentication version. Earlier access
JWTs are rejected, including legacy tokens without a browser session identifier.
Reactivation does not revive previous sessions; sign in again.

| Authentication endpoint | Permission |
|---|---|
| POST /register, /login, /activate, /oauth/exchange; GET /providers | Public, validated |
| POST /refresh, /logout | Refresh cookie with existing CSRF/origin checks |
| GET /me, /account | Any authenticated active role |
| POST /google/link | Active browser session plus password reauthentication |
| GET /admin/me | ADMIN or DISPATCHER (read-only staff identity) |
| GET /admin/users?search=&page=; GET /admin/users/{id} | ADMIN only; 20 users/page |
| POST /admin/users | ADMIN only: name, email, optional phone, role, active |
| POST /admin/users/{id}/role | ADMIN only: role |
| POST /admin/users/{id}/status | ADMIN only: active |
| POST /admin/users/{id}/activation | ADMIN only; credential-free identities |
| GET /admin/users/{id}/audit | ADMIN only; latest 100 events |

Role destinations: CUSTOMER `/customer`, MERCHANT `/merchant`, COURIER `/courier`,
DISPATCHER and ADMIN `/admin`. `/admin/users` is ADMIN-only in React and Spring.
Business dashboards retain their existing Coming Soon state; original dashboard
components remain available on disk. The Auth Service owns all credentials and
identity; future business services must verify tokens and enforce their own permissions.

## Google setup and manual verification

In Google Cloud Console, choose your project and open Google Auth Platform.
Configure Branding, Audience and Data Access (openid, email, profile). For an
external app in Testing, add each permitted Google account as a test user.
Under Clients create an OAuth client of type Web application. Configure:

- Authorized JavaScript origin: http://localhost:3000
- Authorized redirect URI: http://localhost:4000/login/oauth2/code/google
- In ignored backend/auth-service/.env: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
- Keep the existing database settings and JWT_SECRET in that same file
- GOOGLE_REDIRECT_URI: the exact registered backend callback URL
- FRONTEND_URL: the React origin, used for the final /auth/callback redirect

Restart the backend after changing credentials. Without them the service starts
normally, reports Google unavailable through /auth/providers and disables the UI
button. Test credentials/consent-screen test users must be configured in Google.

Google verifies state, nonce and ID tokens through Spring Security OIDC. Only a
verified email is accepted. A returning Google subject can log in; a new subject
creates a CUSTOMER. Password-account email collisions are rejected; matching email alone never links identities.
Inactive accounts are rejected.

For explicit linking, sign in with your password, open **Account** (`/account`), and
select **Connect Google Account**. Re-enter the current password and choose the
verified Google account with the same email. A five-minute, hashed, single-use intent
is bound to the active browser session and browser challenge, then consumed when
OIDC begins. The existing state, nonce, signature, issuer, audience and verifier
checks remain in place. Callback linking checks the original session is still active,
rejects a Google subject already linked elsewhere, preserves the user's role and
records an audit event. Logout, deactivation and role changes invalidate pending
linking. Cancellation or rejected Google proof leaves the account unchanged.
The callback uses the existing one-use exchange and browser session flow. Subsequent
sign-in may use either password or Google. Unlinking is intentionally unavailable;
Google-only users retain their sole login method.

The browser creates a random verifier before redirecting and retains it in
sessionStorage. The callback carries only a 60-second, single-use code in a URL
fragment. React clears the fragment and exchanges the code with the verifier.
Codes are hashed in PostgreSQL and consumed under a row lock. JDBC OAuth state
works across replicas; API calls remain stateless. Configure the same JWT secret,
issuer and database for all replicas. Do not log callback fragments or exchange bodies.

Manual check after configuring Google: sign in with a new verified Google test
user, confirm CUSTOMER navigation, log out, repeat login, and verify a repeated
exchange is rejected. Check cancellation and an inactive Google account as well.
Automated tests complete the signed OIDC protocol against a local provider,
including nonce rejection, new/returning customers, one-use exchange and refresh.
The project owner has manually verified new-account Google login. Automated tests
use a signed local OIDC provider; they do not sign in to personal Google accounts. If Google rejects the request,
check client type, exact redirect URI, test-user membership and saved credentials.

## Password recovery and merchant onboarding

Run each component in a separate terminal, without Docker. Both Java services
automatically import their own ignored `.env` when launched from their directory:

```powershell
cd backend/auth-service
mvn spring-boot:run
```

```powershell
cd backend/merchant-service
mvn spring-boot:run
```

```powershell
cd frontend
npm ci
npm run dev
```

Auth uses port 4000, Merchant 4001 and React 3000. React's optional
`VITE_MERCHANT_API_URL` defaults to `http://localhost:4001` (the client adds the API path).
Keep `FRONTEND_URL` exact for CORS. Existing Docker Compose runs the earlier Auth/UI
stack; it does not launch Merchant. Merchant has its own Dockerfile, but deployment
wiring and Kubernetes changes are outside this milestone.

Merchant's private `.env` uses `MERCHANT_DB_URL`, `MERCHANT_MIGRATION_DB_URL`,
`MERCHANT_DB_USER`, `MERCHANT_DB_PASSWORD`, `AUTH_SERVICE_URL` and
`MERCHANT_SERVICE_TOKEN`; see its `.env.example`. Application traffic may use Neon's
pooled JDBC endpoint and Flyway its direct endpoint, with TLS. Merchant owns only
the `merchant` schema, not Auth tables. Use schema-scoped database users in deployment.
A matching random service token of at least 32 characters belongs in both backend
`.env` files. The local token and Merchant database settings have been configured;
existing Auth database, JWT and Google settings are preserved. Never put this key
in React or a `VITE_` variable. Remote Auth communication requires HTTPS; loopback
HTTP is permitted for development.

**Password recovery:** `/forgot-password` calls `POST /api/v1/auth/password/forgot`.
The response is generic for known, unknown, inactive and Google-only identities.
Password-enabled accounts in all five roles receive a 20-minute single-use link
when SMTP is configured. Google-only accounts must continue with Google. The reset
page `/reset-password` clears its token fragment, validates matching passwords and
calls `POST /api/v1/auth/password/reset`. Successful reset revokes all existing
sessions/JWTs and outstanding reset links, records an audit event and requires login.
Only token hashes are stored. Shared rate limits allow three requests per email and
20 per source IP per 15 minutes; configure trusted reverse-proxy handling before
deployment because the service uses the direct request peer address.

Provide these privately in `backend/auth-service/.env` to enable real mail:
`MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`,
`MAIL_SMTP_AUTH`, `MAIL_SMTP_STARTTLS`. Defaults are port 587 with authentication and
STARTTLS enabled. A local SMTP sandbox can explicitly disable both options. OAuth
client credentials are not SMTP credentials. Mail delivery is asynchronous with a
bounded in-process queue; failed delivery removes that link and requires a new
request. There is no durable mail queue or automatic mail retry. SMTP is currently
unconfigured; fake-mail tests passed, but live sent/received email is unverified.

**Merchant workflow:** CUSTOMER and pre-provisioned MERCHANT identities can open
`/merchant/apply`, submit one business application, and view
`/merchant/application-status`. Submission never grants a role. Applicants may edit
pending/rejected applications; rejected applications require explicit resubmission.
ADMIN opens `/admin/merchants` to search/filter/page through applications, inspect
details/history, and confirm approval or reject with a reason. DISPATCHER cannot
review. Approved merchants see their business profile at `/merchant`; delivery-order
features remain Coming Soon. MERCHANT role by itself grants no approved-business access.

Merchant validates each bearer through Auth `/api/v1/auth/me`. Approval first persists
`APPROVING`, then invokes Auth's narrow
`POST /api/v1/auth/internal/merchant-approvals/{applicationId}` using both the ADMIN
bearer and backend service key. The operation accepts only the target user ID,
is idempotent by application ID, audits grants and revokes CUSTOMER sessions when
changing the role. The applicant signs in again. Existing MERCHANT identities are
reused without duplicate accounts. Only successful synchronization becomes APPROVED.
If Auth fails or a response is lost, status remains APPROVING; ADMIN retries approval
with fresh authorization. No bearer is stored for background retry, and a later
manual role demotion is not silently reversed by replaying an old grant.

Additive migrations are Auth V5 (reset hashes/rate limits), Auth V6 (idempotent role
grants), and Merchant V1 (applications/review audit). Earlier migrations are preserved.
New tests use isolated H2 fixtures and fake SMTP, never live privileged Neon users.

```powershell
mvn -f backend/auth-service/pom.xml test
mvn -f backend/merchant-service/pom.xml test
cd frontend
npm test
npm run build
```

Current suites pass 86 Auth tests (two browser suites opt in separately), 18 Merchant
tests and 42 frontend tests. Both executable packages and the React production build
pass. The new Edge suite passed seven scenario groups against real HTTP Auth and
Merchant servers with separate isolated H2 databases, including fake-mail password
reset, customer approval/role revocation, pre-provisioned merchant restrictions and
rejection/correction/resubmission. To repeat, package Merchant, generate its test
runtime classpath with Maven `dependency:build-classpath -Dmdep.includeScope=test
-Dmdep.outputFile=target/test-runtime-classpath.txt`, then run Auth tests with
`-Donboarding.browser.tests=true -Dtest=OnboardingBrowserTest`. Edge and the same
Playwright installation described below are required.

Live Neon readiness passed for both services. Read-only checks confirmed successful
Auth V5/V6 and Merchant V1 migrations and the new tables. No live test identities
were created. Flyway reports that the current PostgreSQL 18 server is newer than
its tested PostgreSQL support range; migrations and Hibernate validation succeeded.

Manual acceptance: configure SMTP and confirm receipt/reset/replay rejection; submit
a CUSTOMER business, approve as ADMIN, sign in again and check the approved profile;
repeat rejection/edit/resubmission with an existing MERCHANT. Stop Auth during a
review to check recoverable processing, restart it and retry as ADMIN. Live Google
link consent and live SMTP receipt remain manual checks; automated OIDC tests use
the signed local provider.

## Earlier authentication verification

The authentication suite passes 65 backend tests and 30 frontend tests. The React
production build and executable Auth Service packaging pass. Live Neon readiness,
Flyway V4 validation and read-only checks of the new identity tables also pass.
No live privileged test identities were created. Edge browser checks verified registration/login, HttpOnly cookies, refresh
restoration and rotation, new-tab restoration, cross-tab logout, copied JWT revocation
and invalid-cookie clearing. BCrypt storage was checked directly in Neon; the temporary
verification customer was deleted. Previous live Google authorization redirects contained state and nonce. Live
Google linking for an existing password account still needs manual consent testing.
Tests cover rotation, concurrent reuse, family revocation,
logout, absolute expiry, inactive accounts, CSRF/origin rejection, cookie flags,
browser restoration, API retry, logout failure and the signed Google OIDC flow.

A separate optional Edge browser suite passed eight scenario groups covering all
five roles, activation/provisioning through the UI, role-change revocation,
deactivation and audit display. It runs a real Spring HTTP server with isolated H2
fixtures and redirects browser API calls to that test server; it never creates
privileged accounts in Neon. Existing Neon users are not test fixtures.

To repeat it, install Microsoft Edge and have a local Playwright module available.
Set SWIFTDROP_PLAYWRIGHT_PATH to that module directory if needed; the existing
ignored backend/auth-service/target/browser-verification/node_modules/playwright
is detected automatically. Then run:

```powershell
mvn -f backend/auth-service/pom.xml test '-Dauth.browser.tests=true' '-Dtest=RoleBrowserTest'
```

```powershell
mvn -f backend/auth-service/pom.xml test
cd frontend
npm test
npm run build
```

The default backend suite uses an isolated H2 database in PostgreSQL mode and
executes the Flyway migrations. The opt-in Testcontainers suite executes the same
contract and authorization tests against real PostgreSQL; it never uses your
application database. Frontend tests also cover protected routing, registration errors and the StrictMode
OAuth callback without duplicate exchanges.

See [architecture](docs/architecture.md), [service ownership](backend/README.md)
and [Kubernetes setup](infrastructure/kubernetes/README.md). Kubernetes needs a
registry image, PostgreSQL, Secrets and your existing HTTPS Ingress. No real secret
values are included. Previous documentation is historical:
[original README](docs/legacy-readme.md), [original design](DESIGN_DOCUMENTATION.md).

Next milestone: Parcel and Courier Services, asymmetric token verification across services, RabbitMQ
notifications/webhooks and real-time tracking. Existing Node notification code is
preserved under the optional legacy-notifications Compose profile, but Auth
publishes no events. Configure its own mail/RabbitMQ settings before enabling it.
