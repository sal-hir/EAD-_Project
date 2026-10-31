# SwiftDrop — initial authentication milestone

The existing React 18/Vite/Tailwind interface now uses a Java 21 / Spring Boot
3.5.16 Auth Service. Customer registration, password login, short-lived JWTs,
current-user verification and role authorization are implemented. Google OIDC
is optional. Parcel, merchant, courier and notification business operations are
not implemented in this slice; their UI routes show an explicit coming-soon state.
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
header retains the existing expiry-only JWT behavior.

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

There is no public staff provisioning endpoint. For local role testing, register
an account and have the database owner update only that account's auth.users.role
to an allowed role. Production needs an audited administrator provisioning flow.
Merchant onboarding/approval belongs to the future Merchant Service and is deferred.

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
creates a CUSTOMER. Password-account email collisions are rejected to prevent
unsafe automatic linking. Use that account's password; explicit authenticated
Google linking is deferred. Inactive accounts are rejected.

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
A real Google account must still complete the consent screen manually; automated
tests do not sign in to your personal Google account. If Google rejects the request,
check client type, exact redirect URI, test-user membership and saved credentials.

## Verification

The authentication suite passes 38 backend tests and 17 frontend tests. The React
production build passes. Live Neon readiness and the refresh-session Flyway migration
also pass. Edge browser checks verified registration/login, HttpOnly cookies, refresh
restoration and rotation, new-tab restoration, cross-tab logout, copied JWT revocation
and invalid-cookie clearing. BCrypt storage was checked directly in Neon; the temporary
verification customer was deleted. Live Google authorization redirects contain state
and nonce. The headless check timed out waiting for a Google account form; actual
Google account sign-in and consent remain manual and are not claimed as verified.
Tests cover rotation, concurrent reuse, family revocation,
logout, absolute expiry, inactive accounts, CSRF/origin rejection, cookie flags,
browser restoration, API retry, logout failure and the signed Google OIDC flow.

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

Next milestone: merchant application/approval, audited staff provisioning, Parcel
and Courier Services, asymmetric token verification across services, RabbitMQ
notifications/webhooks and real-time tracking. Existing Node notification code is
preserved under the optional legacy-notifications Compose profile, but Auth
publishes no events. Configure its own mail/RabbitMQ settings before enabling it.
