Suggested branch: `feature/member5-merchant-order-intake`

Title: Add merchant order dashboard and signed webhook delivery with persistent retries

External shop backends can now submit and retrieve owned orders through
`/api/v1/merchant/orders` using existing Merchant API keys or scoped OAuth machine
tokens. Requests are validated and stored in Merchant's schema. Reusing the same
idempotency key and payload returns the original order; conflicting retries return
409. Merchant ownership is derived exclusively from verified credentials.

Approved merchants can view orders and details in the active dashboard and configure
webhook delivery using browser authentication. Order acceptance queues an event in
the order transaction. A persistent worker sends HMAC-signed notifications, records
attempts, retries failures with exponential backoff, and recovers expired worker
leases. Settings support enable/disable, one-time secret creation/rotation and
cancellation of queued work. Logs and a rate-limited tester are available in the UI.

Signing secrets use merchant-bound AES-GCM encryption under a separately configured
WEBHOOK_ENCRYPTION_KEY. The HTTPS transport pins validated public addresses, verifies
TLS and does not follow redirects. Merchant Deployment/ClusterIP manifests include
two replicas, probes, resource requests/limits and Secret references. Docker builds
use repository root context to include documentation/manifests for contract tests.

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

Validation: Merchant Maven suite passed 76 tests, including 12 webhook/manifest tests,
14 Orders tests and 5
HTTP booking gateway tests. All 33 Postman request definitions, including 25 negatives,
were exercised through MockMvc with isolated H2 and fake Auth identities. OpenAPI
references, request example and required response fields were verified against the
API. All 101 frontend tests and the Vite production build pass. Kubernetes manifest
relationships were checked offline; no cluster was configured for kubectl discovery.
No live Parcel/Neon end-to-end run, external receiver delivery or rollout was performed.
