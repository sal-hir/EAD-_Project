# Member 5: Merchant Orders API

The first increment implements authenticated, durable **order intake**, inside the
existing Merchant Service (port 4001). It reuses Member 4's API-key and OAuth
validation directly; it does not create another credential system or query Auth tables.

**Booking is not implemented:** this checkout has no Member 2 Parcel/Booking service.
New orders return **202 Accepted**, `status=PENDING_BOOKING`, `parcelId=null` and
`trackingNumber=null`. They remain pending; no worker submits them automatically yet.
The tracking endpoint reports this explicitly. Do not present this as a completed
Merchant → Parcel delivery flow. No prices or tracking numbers are fabricated.

## Routes and authentication

Base: `http://localhost:4001/api/v1/merchant/orders`.

| Method | Suffix | Result | OAuth permission |
| --- | --- | --- | --- |
| POST | empty | Accept order (202); exact retry (200) | `orders:write` |
| GET | `?page=0&size=20` | Owned orders and total (200) | `merchant:read` |
| GET | `/{id}` | Owned order (200) | `merchant:read` |
| GET | `/{id}/tracking` | Booking/tracking availability (200) | `merchant:read` |

Send **one** `X-API-Key` header **or** one `Authorization: Bearer <opaque machine token>`.
Mixed/duplicated mechanisms and browser login JWTs are rejected. Every request checks
current business approval, credential validity and current Auth account eligibility.
Auth outages fail closed (503). OAuth read permission is a local design choice using
the existing `merchant:read` scope; the team must confirm it before external release.
Machine credentials belong in shop server code, never browser frontend code.

See [API keys](merchant-api-keys.md) and [OAuth token issuance](merchant-oauth.md).
Returned `merchantId` is the business application UUID; ownership always comes from
authenticated identity. Foreign and nonexistent order IDs both return 404.

## Request example

POST requires `Content-Type: application/json` and `Idempotency-Key: checkout-123`.

```json
{
  "merchantOrderId": "SHOP-123",
  "pickup": {
    "name": "Online Shop", "phone": "+94771234567",
    "address": "1 Main Road", "district": "Colombo"
  },
  "recipient": {
    "name": "Customer", "phone": "+94771234568",
    "address": "2 Lake Road", "district": "Galle"
  },
  "parcel": {
    "description": "Books", "weightKg": 1.5,
    "lengthCm": 20, "widthCm": 15, "heightCm": 10
  },
  "serviceType": "STANDARD",
  "notes": "Call before arrival"
}
```

Request fields are validated recursively; unknown fields are rejected. Order
references use 1–100 ASCII letters/digits/dot/underscore/hyphen, starting with a
letter/digit. Keys allow colon additionally and are 1–128 characters. Weight is
0.001–1000 kg (3 decimal places); each dimension is 0.1–500 cm (1 decimal place).
Service is STANDARD or EXPRESS. These are provisional intake limits, not agreed
pricing or booking rules. Notes are optional, up to 1000 characters.

Responses use `{success:true,data:...}`. Order data contains `id`, `merchantId`,
`merchantOrderId`, `status`, nullable `parcelId`/`trackingNumber`, `createdAt`, and
the validated `request`. Lists contain `orders`, `page`, `size`, `total` (max size 100).
Create returns Location and Idempotency-Replayed headers. Responses use no-store.

Identical key, order reference and payload return the same ID. A changed payload,
key reuse for a different reference, or reference reuse with another key returns
409. JSON property order and decimal trailing zeroes do not change the request
fingerprint; strings are compared as submitted. The business row lock serializes
concurrent submissions across service replicas; database unique constraints protect
both merchant reference and key. Retry records persist with the order.

| HTTP | Meaning |
| --- | --- |
| 400 | Invalid JSON/fields/UUID/pagination or missing/invalid idempotency key |
| 401 | Missing, expired, revoked, mixed or invalid credentials; ineligible merchant |
| 403 | OAuth token lacks the endpoint's required scope |
| 404 | No owned order at that ID |
| 409 | Reference/key conflicts with an existing request |
| 503 | Authentication validation unavailable |

Errors retain the existing Merchant error envelope:
`{success:false,status,message,errors,timestamp}`.

## Run and verify

Run Merchant using its existing private environment configuration. Normal startup
applies additive Flyway V4 to the merchant schema. No environment changes are
required. Tests use isolated H2, with fake Auth identities and real Merchant API-key
and OAuth credential/token lifecycles; they do not create live Neon test accounts.

```powershell
mvn -f backend/merchant-service/pom.xml test
```

Import [Postman collection](postman/merchant-orders.postman_collection.json).
Set baseUrl, a real approved merchant apiKey or machine accessToken privately.
Run Create, List, Details, Tracking, then Create again unchanged to see replay.
Change the payload with the same key to see 409. Authenticate as another merchant
to verify 404 for the saved order ID. The collection saves the returned orderId.
The static [OpenAPI specification](openapi/merchant-orders.yaml) can be imported
into Swagger Editor or Postman; no Swagger UI endpoint is installed by this change.

## Member 2 handoff — agreement still required

Confirm these before connecting a real booking adapter:

- Parcel creation URL, backend service authentication, response/error envelope.
- Pickup/recipient address fields, district/zone identifiers, weight/dimensions,
  service codes and pricing/payment requirements. The intake JSON above is proposed.
- Stable upstream idempotency identity based on Merchant order UUID. Network timeouts
  must be recoverable by retry/lookup without creating duplicate parcels.
- Booking response must supply the authoritative parcel UUID, tracking number and
  status. Persist that mapping and provide a durable submission/reconciliation worker
  before changing acceptance to imply successful booking.
- Who owns parcel status and how updates reach order retrieval/tracking. No local
  order status should independently overwrite Parcel/Courier lifecycle state.

## Checklist status

Implemented: proposed endpoints/JSON, validation, persisted order intake, external
reference mapping to local order ID, list/details, explicit pending tracking response,
idempotency, merchant isolation, API key/OAuth integration, consistent API errors,
automated integration tests, Postman collection and static OpenAPI docs.

Pending: external team agreement, Member 2 booking integration, authoritative parcel
and tracking mapping, live tracking/status integration, full Merchant → Auth → Parcel
demo. Webhook dashboard/dispatcher and Kubernetes workloads from the broader Member 5
assignment are also pending. Git push and PR publication have not been performed.
