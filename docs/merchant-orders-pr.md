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

Tracking responses include availability, stable update time and an order-acceptance
event. Duplicate JSON properties/headers, invalid contact data and unsupported
method/media types return consistent errors. The final v1 intake contract documents
existing API-key/OAuth behavior; it does not claim external Member 2 agreement.

A candidate booking adapter and a test-only loopback HTTP mock cover the proposed
Member 2 handoff. The adapter is not wired into production Orders; mock parcel IDs
never enter real order storage. Production orders remain PENDING_BOOKING.

Validation: Merchant Maven suite passed 64 tests, including 14 Orders tests and 5
HTTP booking gateway tests. All 33 Postman request definitions, including 25 negatives,
were exercised through MockMvc with isolated H2 and fake Auth identities. OpenAPI
references, request example and required response fields were verified against the
API. No live Parcel/Neon end-to-end run or deployment was performed.
