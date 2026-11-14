# Merchant Service: local Docker and Phase 1 verification

Member 5 order intake is now available at `/api/v1/merchant/orders`, reusing API-key
and OAuth machine authentication. Orders remain `PENDING_BOOKING` until Member 2
booking integration is implemented. See [Orders API and handoff](../../docs/merchant-orders.md),
[OpenAPI](../../docs/openapi/merchant-orders.yaml) and
[Postman collection](../../docs/postman/merchant-orders.postman_collection.json).

From the repository root, configure the ignored `.env` with the Neon Auth database
connection and `JWT_SECRET`. Set `MERCHANT_SERVICE_TOKEN` to a separate random
secret of at least 32 characters. Compose passes the same token to Auth and
Merchant; it is never exposed as a frontend build argument.

```powershell
docker compose up --build -d auth-service merchant-service frontend
docker compose ps
```

Open the website at http://localhost:3000. Merchant readiness is available at
http://localhost:4001/actuator/health/readiness.

Compose defaults Merchant's connection to the Auth database credentials, but
Merchant owns only the `merchant` schema and Auth owns only `auth`. Optional
`MERCHANT_DB_URL`, `MERCHANT_MIGRATION_DB_URL`, `MERCHANT_DB_USER` and
`MERCHANT_DB_PASSWORD` override these defaults. Separate schema-scoped database
users are appropriate for deployment.

Inside Compose, `AUTH_SERVICE_URL=http://auth-service:4000` and
`AUTH_ALLOW_DOCKER_HTTP=true` explicitly permit HTTP to that exact service name.
The default remains HTTPS outside loopback; this option does not permit arbitrary
remote HTTP hosts. Use HTTPS for deployed service communication.

The browser connects to `VITE_MERCHANT_API_URL`, defaulting to
http://localhost:4001. Rebuild the frontend after changing that build-time value.

## Manual acceptance

1. Register a CUSTOMER at `/register`, sign in and open `/merchant/apply`.
2. Submit valid business details and verify PENDING at
   `/merchant/application-status`. Submission must not grant MERCHANT permissions.
3. Sign in as an existing ADMIN and open `/admin/merchants`. If no ADMIN exists,
   use the one-time interactive bootstrap documented in the root README.
4. Reject with a reason. The applicant must see the reason, edit the details,
   save corrections and explicitly resubmit to PENDING.
5. Approve as ADMIN. The application must become APPROVED only after Auth confirms
   the merchant role. Existing customer sessions are revoked; sign in again and
   verify `/merchant` displays the approved business.
6. A different CUSTOMER, COURIER or DISPATCHER must not review applications.
   A provisioned MERCHANT without business approval must not access an approved
   business profile.

If synchronization fails, the application remains APPROVING. Check both services
and their matching private token, then use ADMIN's Retry approval action. Do not
manually edit roles or database status to bypass synchronization.

## Automated verification

Merchant tests use isolated H2 databases and fake identities:

```powershell
mvn -f backend/merchant-service/pom.xml test
cd frontend
npm test -- --run src/onboarding.test.jsx src/api/client.test.js
```

The root README also documents `OnboardingBrowserTest`, which runs real Auth and
Merchant HTTP servers with isolated H2 databases and Edge/Playwright. It covers
registration, approval, role synchronization, session revocation, rejection,
editing and resubmission without creating privileged accounts in Neon.

API key management is now implemented. See [the API key contract](../../docs/merchant-api-keys.md)
for generation, one-time display, validation, revocation and Member 5 integration.
OAuth client credentials are implemented separately from browser JWTs and API keys.
See [OAuth client management and integration](../../docs/merchant-oauth.md).
For the Kubernetes bonus, use the [ConfigMap/Secret templates and workload references](../../infrastructure/kubernetes/README.md).

## Verification on 2026-11-14

- Merchant backend: 19 tests passed, including Docker HTTP opt-in restrictions,
  applicant ownership, ADMIN review, approval, rejection and resubmission.
- Frontend onboarding and API client: 17 tests passed.
- Auth merchant-role tests and opt-in onboarding browser test: 9 tests passed.
  The browser test completed seven scenario groups against isolated Auth/Merchant
  databases, including approval role synchronization and session revocation.
- The Merchant Docker image also passed its backend tests during packaging.
- Live Docker checks: Merchant readiness returned 200; unauthenticated and forged
  bearer profile requests returned 401. The forged bearer check exercised the
  actual Docker Merchant-to-Auth connection.

The live Neon database was not populated with test identities or merchant
applications for these checks. Live ADMIN review through the browser requires an
existing ADMIN account or the documented interactive bootstrap.
