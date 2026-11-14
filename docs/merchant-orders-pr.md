Suggested branch: `feature/member5-merchant-order-intake`

Title: Add authenticated merchant order intake with idempotency

External shop backends can now submit and retrieve owned orders through
`/api/v1/merchant/orders` using existing Merchant API keys or scoped OAuth machine
tokens. Requests are validated and stored in Merchant's schema. Reusing the same
idempotency key and payload returns the original order; conflicting retries return
409. Merchant ownership is derived exclusively from verified credentials.

New orders return 202 PENDING_BOOKING. Member 2's booking service is absent from this
checkout, so this change does not create parcels or tracking numbers. The tracking
endpoint reports that limitation. docs/merchant-orders.md records the handoff contract
and pending integration work. Includes Flyway V4, OpenAPI and Postman artifacts.

Validation: Merchant Maven suite passed 52 tests, including 7 new Orders tests for
API-key/OAuth lifecycles, expiry/revocation, scope enforcement, ownership isolation,
payload validation, idempotency conflicts and concurrent retries. Tests use isolated
H2 data and fake Auth identities; no live Parcel/Neon end-to-end run was performed.
