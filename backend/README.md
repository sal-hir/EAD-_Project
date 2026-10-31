# Service boundaries

Only auth-service is implemented in this milestone. Every future service will
have its own Maven build, Dockerfile, deployment and database ownership.
No shared JPA entities or cross-service table queries are permitted.

| Service | Owns | Planned contract |
| --- | --- | --- |
| Auth | Identity, password hashes, Google subjects, roles, active status | /api/v1/auth/** |
| Parcel | Delivery requests, pricing, tracking history | /api/v1/parcels/**, /api/v1/tracking/** |
| Merchant | Business profiles, administrator approval, API keys | /api/v1/merchants/** |
| Courier | Courier profiles and assignments | /api/v1/couriers/** |
| Notification | Email delivery, event consumption, webhook retries | RabbitMQ consumers |

Merchant onboarding is deferred, with no merchant registration or approval API
in Auth. Future onboarding must create a pending business application and grant
merchant privileges only after administrator approval. Public identity signup
only creates CUSTOMER accounts. Staff provisioning needs a separate, audited
administrative workflow; there are no seeded passwords or public role endpoints.

Future services must validate signed access tokens and enforce current account
status and business permissions. A shared HMAC secret is acceptable only inside
the present single-service boundary: plan asymmetric signing/JWKS and a clear
account-revocation policy before adding independent token consumers.

RabbitMQ event producers/consumers, real-time tracking and webhooks are deferred.
The root notification-service is preserved legacy code and disabled by default.
