# Candidate Member 2 booking boundary and test mock

This is a proposed integration contract for review, not evidence that Member 2
implements it. No real booking service is configured or invoked by production Orders.

The candidate HttpBookingGateway sends POST to an explicitly supplied full endpoint
(the mock uses `/api/v1/parcels`). It sends `Content-Type: application/json`,
`Accept: application/json`, `X-SwiftDrop-Service-Key: <private backend credential>`
and `Idempotency-Key: <Merchant order UUID>`. Never forward merchant API keys,
OAuth machine tokens or user JWTs to this boundary. Business ownership is derived
from the authenticated persisted order before constructing the booking request.

Request:

```json
{
  "orderId": "11111111-1111-4111-8111-111111111111",
  "merchantId": "22222222-2222-4222-8222-222222222222",
  "order": {
    "merchantOrderId": "SHOP-123",
    "pickup": {"name":"Shop","phone":"+94771234567","address":"1 Main Road","district":"Colombo"},
    "recipient": {"name":"Customer","phone":"+94771234568","address":"2 Lake Road","district":"Galle"},
    "parcel": {"description":"Books","weightKg":1.5,"lengthCm":20,"widthCm":15,"heightCm":10},
    "serviceType": "STANDARD",
    "notes": null
  }
}
```

Expected HTTP 201 (or 200 for replay):

```json
{
  "success": true,
  "data": {
    "orderId": "11111111-1111-4111-8111-111111111111",
    "parcelId": "33333333-3333-4333-8333-333333333333",
    "trackingNumber": "MOCK-1",
    "status": "CREATED"
  }
}
```

The adapter validates correlation orderId, parcel UUID, a nonempty tracking number
and CREATED status before returning a booking result. Non-success HTTP responses,
malformed/incomplete/mismatched payloads and timeouts fail with a sanitized 503.
Remote bodies and private credentials are never included in errors. It uses explicit
connect/request timeouts, does not follow redirects, and permits HTTP only to literal
loopback hosts; other destinations require HTTPS. No automatic retry occurs: a future
durable worker must reuse the same order UUID for retries/reconciliation.

MockBookingServer lives under `src/test/java`, binds an ephemeral 127.0.0.1 port,
checks the test-only private service key and stores mock bookings in memory by the
idempotency key. A repeated request returns the same parcel ID. It is not included
in the executable application JAR and has no live environment configuration.

Run from repository root:

```powershell
mvn -f backend/merchant-service/pom.xml test
```

BookingGatewayIntegrationTest covers the HTTP adapter, retries, upstream error,
bad credential, malformed response, response correlation, timeout recovery and URI
validation. OrderIntegrationTest connects real isolated order intake to the mock
using the persisted merchant/order identity, and confirms live-facing order tracking
still says PENDING_BOOKING. This is a mock integration demo, not the live Parcel demo.

Before enabling production booking: agree the Member 2 endpoint, fields, service
authentication, pricing rules and response schema; add durable submission/reconciliation,
persist authoritative parcel/tracking mapping and integrate authoritative status updates.
