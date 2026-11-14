# Merchant OAuth 2.0 client credentials — Member 4

This adds the confidential-client `client_credentials` grant described in
[RFC 6749 section 4.4](https://www.rfc-editor.org/rfc/rfc6749#section-4.4), with
`client_secret_basic` authentication and
[Bearer token usage](https://www.rfc-editor.org/rfc/rfc6750#section-2.1).
Google login and Auth's user JWT/session system remain separate.

The implemented integration choice is **opaque access tokens issued by Merchant
Service**, validated online against Merchant storage and current Auth identity.
They are not JWTs and cannot be decoded/validated with Auth's `JWT_SECRET`.
This avoids giving merchant applications user-login or ADMIN privileges and makes
rotation/revocation effective without waiting for token expiry. It is the local
contract for Members 1 and 5 to review; external agreement and actual Orders API
integration have not been verified by this implementation.

## Credential management (browser user JWT)

Merchant base URL locally: `http://localhost:4001/api/v1`.

| Method | Path | Access |
| --- | --- | --- |
| GET | `/merchants/oauth-clients` | MERCHANT: owned business metadata and approval flag |
| POST | `/merchants/oauth-clients` | Approved MERCHANT: create client, show secret once (201) |
| POST | `/merchants/oauth-clients/{id}/rotate` | Approved owner: replace secret and invalidate all issued tokens |
| POST | `/merchants/oauth-clients/{id}/revoke` | Owner: permanently revoke client and issued tokens |
| GET | `/merchants/admin/applications/{merchantId}/oauth-clients` | ADMIN: metadata only |
| POST | `/merchants/admin/applications/{merchantId}/oauth-clients/{id}/revoke` | ADMIN: revoke selected business client |

These endpoints use the existing `Authorization: Bearer <user JWT>`. API keys,
client secrets and OAuth machine tokens cannot manage credentials. ADMIN cannot
generate, retrieve or rotate another merchant's secret.

Create body:

```json
{"label":"Store backend","scopes":["merchant:read","orders:write"]}
```

Supported permissions:

| Scope | Meaning |
| --- | --- |
| `merchant:read` | Read the authenticated merchant application's safe identity |
| `orders:write` | Authorize submission to the future Merchant Orders API |

Choose at least one permission; scope sets are immutable for a client. Revoke and
create another client to change allowed permissions. At most five clients can be
active per merchant. The active-first metadata list contains up to 100 clients.

Creation/rotation return the usual `{success:true,data:{credential,clientSecret}}`.
`credential` includes ID, merchant/business ID, public `clientId`, label, scopes,
status and created/rotated/revoked timestamps. Listing/revocation never return a
secret or hash. `merchantId` is the merchant application UUID, not the Auth user ID.

Merchant UI: `/merchant/oauth-clients`, linked from the sidebar and API credentials
page. ADMIN follows **Manage OAuth clients** from merchant application review.
The secret is displayed only once in page memory, copied only on explicit action
and removed on dismissal, navigation, reload or identity change. Rotation and
revocation require confirmation. Secret values are not saved to browser storage.
If a creation/rotation response is lost, the secret cannot be recovered; inspect
the client list and rotate again or revoke the unusable client.

## Token request (server-to-server)

```http
POST /api/v1/oauth/token
Authorization: Basic <base64(form-encoded-client-id:form-encoded-client-secret)>
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&scope=merchant%3Aread%20orders%3Awrite
```

Only HTTP Basic client authentication is supported. Credentials in form fields,
query parameters or API-key headers are rejected. Exactly one Authorization
header is required. The optional `scope` parameter must be a nonempty subset of
the client's allowed scopes; omission requests all allowed scopes. Password,
authorization-code and refresh-token grants are unsupported. No refresh token
is issued; request a new access token using the current client credentials.

Success is a standard OAuth response, without the application's envelope:

```json
{"access_token":"<opaque secret>","token_type":"Bearer","expires_in":900,"scope":"merchant:read orders:write"}
```

All token responses, including errors, use `Cache-Control: no-store` and
`Pragma: no-cache`. Store/cache a token securely on your server until shortly
before expiry rather than requesting a token for every API call. A client is
limited to 100 unexpired tokens; exceeding the limit returns 503. Expired tokens
are pruned on issuance and hourly. A server restart does not invalidate existing
tokens because only token hashes and validation metadata are persisted.

PowerShell example (set these environment values privately):

```powershell
curl.exe --user "${env:SWIFTDROP_CLIENT_ID}:${env:SWIFTDROP_CLIENT_SECRET}" `
  --data "grant_type=client_credentials" `
  --data-urlencode "scope=merchant:read orders:write" `
  http://localhost:4001/api/v1/oauth/token
```

Use HTTPS at the deployed ingress/API boundary and between deployed services.
Localhost HTTP examples are for local development only. Do not put client
secrets or tokens in frontend VITE variables, URLs or request logs.

## Token validation, permissions and Member 5

Read identity:

```http
GET /api/v1/merchant-api/oauth/identity
Authorization: Bearer <access_token>
```

This requires `merchant:read`. For order submission authorization, Member 5 calls:

```http
GET /api/v1/merchant-api/oauth/authorize?scope=orders%3Awrite
Authorization: Bearer <access_token>
```

This endpoint checks `orders:write` and does not require `merchant:read`. It does
not create an order. Both return the safe application envelope:

```json
{
  "success":true,
  "data":{
    "merchantId":"<business UUID>","userId":"<Auth user UUID>",
    "clientId":"<public client identifier>","scopes":["orders:write"],
    "expiresAt":"<ISO timestamp>","audience":"swiftdrop-merchant-api"
  }
}
```

Member 5 should require a successful authorization response, derive order
ownership from the returned `merchantId`, and fail closed if authorization is
unavailable. The Orders handler must choose `orders:write` itself; never let an
incoming order request choose the permission being checked. Never trust a
business ID supplied by the order payload, decode
opaque tokens as JWTs, accept invented identity headers, query another service's
tables or cache authorization if immediate revocation is required.

API-key authentication continues at `/api/v1/merchant-api/identity` using one
`X-API-Key` header. OAuth continues at `/api/v1/merchant-api/oauth/**` using one
Bearer header. Mixing credential mechanisms is rejected. OAuth tokens cannot
access browser management, Auth user APIs or ADMIN review.

## Validation and lifecycle

- Public client IDs use `sd_client_` plus a random UUID identifier. Secret format
  is `sd_cs_` plus 43 base64url characters from 32 cryptographically random bytes.
- Access tokens use `sd_at_` plus 43 random base64url characters. Only SHA-256
  hashes of secrets and tokens are stored. Secret/token DTO log representations
  are redacted.
- Flyway V3 adds `merchant.oauth_clients`, `merchant.oauth_access_tokens` and
  `merchant.oauth_client_audit`. Actor IDs and times are recorded for creation,
  secret rotation and revocation. Full secret/token values are never persisted.
- Each validation checks token expiry/audience, client ACTIVE status/credential
  version, business APPROVED status and current Auth active/MERCHANT state. It
  rechecks token/client/business state after the Auth lookup. Auth outages fail
  closed. The existing private `MERCHANT_SERVICE_TOKEN` protects that Auth lookup.
- Rotation/revocation serialize with issuance using a lock on the business row.
  Rotation changes the secret hash, increments the credential version and removes
  issued token hashes. Revocation is idempotent, permanent and removes tokens.
  Old tokens do not revive after account reactivation if the client was revoked.
- Deactivation, role changes or loss of business approval block issuance and
  token validation. Re-enabling an otherwise eligible identity can restore an
  unexpired token whose client has not been rotated/revoked.
- Already-authorized requests may be in flight when revocation occurs;
  subsequent validation fails.

Configuration: `MERCHANT_OAUTH_TOKEN_TTL_SECONDS` defaults to 900 and must be
60–3600. Compose passes it to Merchant only. No new JWT signing secret or
cross-service shared JWT key is needed for opaque tokens.

| Endpoint / status | Meaning |
| --- | --- |
| Token 400 `invalid_request` | Missing/duplicated/unsupported form fields or mixed mechanisms |
| Token 400 `unsupported_grant_type` | Grant is not `client_credentials` |
| Token 400 `invalid_scope` | Requested scope is empty, unknown or not granted |
| Token 401 `invalid_client` | Bad/missing Basic credentials, inactive/revoked client or ineligible merchant |
| Token 503 `temporarily_unavailable` | Auth/storage unavailable or active-token limit reached |
| Resource 401 + Bearer `invalid_token` challenge | Invalid/expired/revoked token or ineligible identity |
| Resource 403 + Bearer `insufficient_scope` challenge | Valid token lacks the required permission |
| Resource 503 | Identity/token validation unavailable |

## Repeat verification

```powershell
mvn -f backend/merchant-service/pom.xml test dependency:build-classpath `
  -Dmdep.includeScope=test -Dmdep.outputFile=target/test-runtime-classpath.txt
cd frontend
npm test
cd ..
docker compose up --build -d merchant-service frontend
```

With the existing Edge/Playwright test setup from the root README, run the opt-in
Auth `OnboardingBrowserTest`. It uses separate H2 databases for Auth/Merchant and
now covers client provisioning, token issuance, scope enforcement, rotation,
deactivation and ADMIN revocation through actual HTTP services and React pages.

Verified on 2026-11-14: all 45 Merchant backend tests and all 93 frontend tests
passed. The explicit browser suite passed 14 full-flow scenario groups, including
the existing onboarding/API-key scenarios and new OAuth flows. The Docker image
also passed the backend suite during packaging. Flyway applied Merchant V3.
Test identities, clients and tokens were created only in isolated test databases;
the live Neon database received the schema migration, without seeded credentials.
