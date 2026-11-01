# Service boundaries

Auth Service and Merchant Service are implemented. Each has its own Maven build,
Dockerfile and database schema; deployment wiring remains environment-specific.
No shared JPA entities or cross-service table queries are permitted.

| Service | Owns | Planned contract |
| --- | --- | --- |
| Auth | Identity, password hashes, Google subjects, roles, active status | /api/v1/auth/** |
| Parcel | Delivery requests, pricing, tracking history | /api/v1/parcels/**, /api/v1/tracking/** |
| Merchant | Business applications, profiles, administrator approval and audit | /api/v1/merchants/** |
| Courier | Courier profiles and assignments | /api/v1/couriers/** |
| Notification | Email delivery, event consumption, webhook retries | RabbitMQ consumers |

Merchant owns only the `merchant` schema. Auth owns only `auth`, including password
recovery and the narrowly scoped internal merchant-role grant. Merchant validates
every bearer through Auth `/api/v1/auth/me`; it never receives the JWT signing key
or reads Auth tables. Role synchronization requires both an active ADMIN bearer
and a backend-only shared service credential. Public signup remains CUSTOMER-only.
API keys, orders and delivery operations remain deferred.

Future services must validate signed access tokens and enforce current account
status and business permissions. A shared HMAC secret is acceptable only inside
the present single-service boundary: plan asymmetric signing/JWKS and a clear
account-revocation policy before adding independent token consumers.

RabbitMQ event producers/consumers, real-time tracking and webhooks are deferred.
The root notification-service is preserved legacy code and disabled by default.
