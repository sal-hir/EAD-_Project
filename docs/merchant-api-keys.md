# Merchant API keys — Member 4 / Member 5 integration contract

This implements API-key authentication. OAuth 2.0 client credentials and the
Merchant Orders implementation are separate phases. Member 5 must integrate and
verify this contract in their Orders service before claiming end-to-end order
submission support.

## Browser credential management

Base URL: Merchant Service (`http://localhost:4001/api/v1` locally). These endpoints
require the existing Auth **Bearer JWT**, never an API key. Auth verifies the
current identity and active status on every management request.

| Method | Path | Permission / result |
| --- | --- | --- |
| GET | `/merchants/api-keys` | MERCHANT: owned business approval flag and safe key metadata |
| POST | `/merchants/api-keys` | Approved MERCHANT only; body `{"label":"Store integration"}`; 201 |
| POST | `/merchants/api-keys/{keyId}/revoke` | MERCHANT: revoke an owned key; repeated revocation is idempotent |
| GET | `/merchants/admin/applications/{merchantId}/api-keys` | ADMIN: inspect metadata for one business |
| POST | `/merchants/admin/applications/{merchantId}/api-keys/{keyId}/revoke` | ADMIN: revoke a key belonging to the selected business |

`merchantId` is the **merchant application/business UUID**, not the Auth user UUID.
Identity and ownership come from verified authentication, never request fields.
Admins can revoke and inspect metadata, but cannot generate/retrieve another
merchant's secret. Unapproved merchants cannot generate or use keys; they can
still revoke existing owned keys while they retain a valid MERCHANT identity.

Success uses `{"success":true,"data":...}`. Creation returns:

```json
{
  "success": true,
  "data": {
    "credential": {
      "id": "<key UUID>",
      "merchantId": "<business UUID>",
      "label": "Store integration",
      "prefix": "<non-secret key prefix>",
      "status": "ACTIVE",
      "createdAt": "<ISO timestamp>",
      "revokedAt": null
    },
    "apiKey": "<full key returned only by creation>"
  }
}
```

List returns `{merchantId, approved, keys:[...safe metadata...]}`. Revocation returns
the updated metadata with `status=REVOKED` and `revokedAt`. All responses use
`Cache-Control: no-store`. No retrieval endpoint returns full keys or hashes.

The UI is `/merchant/credentials`, linked from the merchant dashboard/sidebar.
ADMIN opens a business in `/admin/merchants` and follows **Manage API keys**.
The full secret is held only in page memory, shown once and copied only on an
explicit action. Dismissal, navigation, reload or identity change removes it.
If a creation response is lost, inspect the list and revoke the unused key; the
server cannot recover its full value.

## Machine authentication / Orders integration

```http
GET /api/v1/merchant-api/identity
X-API-Key: <full merchant API key>
```

There must be exactly one `X-API-Key` header. Do not also send an Authorization
header. Query parameters, cookies and browser JWTs are not accepted as API keys.

A valid key returns:

```json
{"success":true,"data":{"merchantId":"<business UUID>","userId":"<Auth UUID>","keyId":"<key UUID>"}}
```

PowerShell check (set `SWIFTDROP_API_KEY` privately in your local environment):

```powershell
curl.exe -H "X-API-Key: $env:SWIFTDROP_API_KEY" http://localhost:4001/api/v1/merchant-api/identity
```

Member 5 should forward the incoming header server-to-server to this endpoint,
require a successful 200 envelope, then use the returned `merchantId` as the
authenticated order owner. Reject missing/invalid/revoked keys and fail closed
when validation is unavailable. Do not trust a merchant ID supplied by an order
request, accept caller-invented identity headers, read Merchant's tables directly,
or log the raw key. Do not cache successful validation if immediate revocation
and account-state enforcement are required. Use HTTPS between deployed services.

API keys authenticate only `/api/v1/merchant-api/**`; they never grant access to
browser credential management, approval, account or ADMIN endpoints. The current
machine endpoint is a concrete authentication demo; it does not create orders.

## Storage and validation

- Format: `sd_mk_` followed by 43 base64url characters from 32 SecureRandom bytes
  (256 bits). The prefix displayed later includes only the first eight random
  characters and cannot reconstruct the full key.
- Flyway V2 creates `merchant.api_keys` and `merchant.api_key_audit`. Only SHA-256
  hashes of high-entropy keys are stored; full keys are never persisted.
- Metadata includes business ID, label, prefix, status, creator and timestamps;
  revocation also records the actor. Audit rows record creation/revocation.
- At most five active keys per business. Issuance/revocation serialize on the
  application row to enforce the limit under concurrent requests. The list shows
  active keys first and up to 100 metadata records (including revoked history).
- Each validation checks key status, business APPROVED status and current Auth
  MERCHANT/active state. It rechecks key/business state after the Auth lookup.
  Requests authenticated before a revocation may already be in flight; subsequent
  validation fails. Account deactivation/role changes block keys without requiring
  a browser login. Reactivating an otherwise eligible account can restore access
  to keys that were not explicitly revoked.

For current identity checks Merchant calls Auth's narrowly scoped
`POST /api/v1/auth/internal/merchant-api/identity` with `{userId}` and the private
`X-SwiftDrop-Service-Key` header. This endpoint validates the configured shared
`MERCHANT_SERVICE_TOKEN` and returns only ID, role and active state. No browser
bearer or API key can substitute for the private service credential. This extends
the existing Auth integration; it does not introduce another token issuer.

| Status | Meaning |
| --- | --- |
| 400 | Invalid management body or injected/unknown properties |
| 401 | Missing/malformed/unknown/revoked API key, lost approval or ineligible identity |
| 403 | Browser role/business approval does not permit the requested management action |
| 404 | Credential/business is unavailable to the management caller |
| 409 | Five active keys already exist |
| 503 | Auth, database validation or private service configuration is unavailable |

## Verification

```powershell
mvn -f backend/merchant-service/pom.xml test
mvn -f backend/auth-service/pom.xml -Dtest=MerchantApiIdentityTest,MerchantRoleIntegrationTest,AuthIntegrationTest test
cd frontend
npm test -- --run src/merchant-credentials.test.jsx src/onboarding.test.jsx src/api/client.test.js
```

`frontend/e2e/onboarding.cjs` extends the existing opt-in OnboardingBrowserTest
with real Auth/Merchant HTTP servers: merchant key creation, machine request,
metadata-only retrieval, owner revocation/replay, Auth deactivation and ADMIN
revocation. Its databases are isolated H2 fixtures, not the live Neon database.

For local Docker, the existing Compose wiring passes the same backend service
token to Auth and Merchant. Rebuild both services and the frontend:

```powershell
docker compose up --build -d auth-service merchant-service frontend
```

Verified on 2026-11-14: Merchant backend 32/32 tests passed; frontend full suite
85/85 passed; Docker Auth packaging ran 112 tests with zero failures (two optional
browser tests skipped). The opt-in real-browser suite was then run explicitly
and passed all ten onboarding/API-key scenario groups. Live Docker checks returned
200 for the frontend and Merchant readiness, and 401 for missing/invalid API keys.
Flyway applied Merchant V2. Test users, businesses and generated keys remained in
isolated test databases; the live Neon database received the schema migration.
