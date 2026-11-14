# Merchant dashboard and webhook delivery

Approved MERCHANT browser users open `/merchant`. The existing business profile and
credential links remain, followed by orders, status filter, order detail dialog,
webhook settings, delivery history, attempt details and a test-event button. Orders
still use PENDING_BOOKING until Member 2 provides authoritative parcel booking.
Only All / Pending booking are offered because no other order lifecycle is implemented.

## Browser APIs

Base: `/api/v1/merchants/operations`. These routes require a current Auth **user JWT**
for an approved MERCHANT. API keys, OAuth machine tokens and ADMIN identities cannot
manage these settings. Ownership always comes from the current authenticated business.
Responses use the existing success/error envelope and `Cache-Control: no-store`.

| Method | Route | Body/result |
| --- | --- | --- |
| GET | `/orders?page=0&size=20&status=PENDING_BOOKING` | Owned orders; empty status means all |
| GET | `/orders/{id}` | Owned order details; foreign/missing returns 404 |
| GET | `/webhook` | url, enabled, configured, updatedAt; no secret |
| PUT | `/webhook` | `{url,enabled}`; returns settings and signingSecret only on first creation |
| POST | `/webhook/rotate` | Generates a replacement signingSecret, shown once |
| POST | `/webhook/test` | 202 with deliveryId; requires enabled settings, max ten tests/hour/business |
| GET | `/webhook/deliveries?page=0&size=20` | Delivery summaries and total |
| GET | `/webhook/deliveries/{id}` | Owned summary and attempt history; foreign/missing returns 404 |

Pagination is zero-based, max size 100. Delivery states are PENDING, SENDING, RETRY,
DELIVERED, FAILED, CANCELLED. Attempt summaries contain attemptNumber, responseStatus
(null without an HTTP response), sanitized outcome and createdAt. Response bodies,
signing keys and full event payloads are not returned in logs.

## Configuration and secret lifecycle

Set `WEBHOOK_ENCRYPTION_KEY` privately in the Merchant environment (root `.env` for
Compose or `backend/merchant-service/.env` for direct launch). Use standard base64
encoding of exactly 32 cryptographically random bytes; do not use the Auth JWT secret.
The service starts without this variable, but first-time settings/rotation return
503 until it is configured. Keep the key stable and identical on every replica.
Changing it without migrating ciphertext makes existing webhook keys unreadable.

Example generation in a private PowerShell terminal:

```powershell
$webhookKeyBytes = New-Object byte[] 32
$webhookRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$webhookRng.GetBytes($webhookKeyBytes)
[Convert]::ToBase64String($webhookKeyBytes)
$webhookRng.Dispose()
```

Copy the value into the private environment, not a committed example. Signing
secrets are encrypted with AES-256-GCM and bound to the merchant UUID as associated
data. Only creation/rotation responses reveal the raw `whsec_...` value. The UI keeps
it in component memory, copies only on explicit action and supports dismissal.
Disabling, changing the URL or rotating cancels pending/retry/in-flight database
records; an HTTP request already sent may still arrive. Re-enabling does not revive
cancelled deliveries. Configuration URLs must use HTTPS port 443, without userinfo
or fragments. Network destination checks run on every attempt.

## Events and HMAC verification

Order creation writes `merchant.order.accepted` into the same database transaction
as the order when webhook delivery is enabled. Exact idempotent order retries do not
enqueue another event. Tests enqueue `webhook.test`. The dispatcher can receive future
events through the internal WebhookService.enqueue method, with a stable event key,
inside the producer transaction; no public arbitrary-event injection API exists.
Real parcel status event ingestion remains a team integration task.

Body (the same exact UTF-8 bytes are retained for every retry):

```json
{"id":"<delivery UUID>","type":"merchant.order.accepted","createdAt":"<ISO UTC>","data":{"orderId":"<order UUID>","merchantOrderId":"SHOP-123","status":"PENDING_BOOKING"}}
```

Headers:

- `X-SwiftDrop-Event-Id`: stable delivery/event UUID, also the body id.
- `X-SwiftDrop-Timestamp`: Unix seconds for this attempt.
- `X-SwiftDrop-Signature`: `v1=<lowercase hex HMAC-SHA256>`.

Compute HMAC with the raw UTF-8 signing secret over `timestamp + "." + rawBody`.
Receivers should verify before parsing the body, use constant-time comparison, reject
timestamps outside their replay window (for example five minutes) and deduplicate
by event UUID. Retries are at least once, not exactly once. Store the event ID only
after successful durable processing; return 2xx to acknowledge. Timestamp/signature
change per attempt while the event ID and body stay stable.

The HTTPS transport resolves the destination, rejects private/local/reserved ranges,
pins a checked public address for the connection, and verifies TLS against the
original hostname. It never follows redirects or logs receiver bodies. Connection
and read timeouts are five seconds. Localhost webhooks are intentionally blocked;
automated tests inject a recording transport and do not contact external shops.

## Persistent retries and multiple replicas

The worker polls every five seconds (initial delay ten seconds) and processes up to
20 due records. Any non-2xx result, network failure or unavailable identity validation
retries at 30, 60, 120, 240 and 480 seconds; six total attempts then FAILED. Identity
ineligibility cancels the delivery. Attempts and next due time persist across restart.
Disable the worker with `WEBHOOK_WORKER_ENABLED=false` if needed.

An atomic database claim and 120-second lease prevent simultaneous sends by replicas;
expired leases are recoverable. A crash after the receiver accepts but before the
database acknowledgement can cause a duplicate, so receiver deduplication is mandatory.
The attempt count includes claimed work; a crashed attempt may have no completed
attempt record. Production log retention/archival is not automated in this increment.

## Kubernetes

`infrastructure/kubernetes/merchant-deployment.yaml` contains Deployment + ClusterIP
Service, two replicas, port 4001, startup/readiness/liveness probes, 100m CPU / 256Mi
memory requests and 1 CPU / 512Mi limits. It uses a nonroot UID, read-only root filesystem,
dropped capabilities and a writable temporary volume. It consumes merchant-config,
merchant-secrets, merchant-integration-secrets and merchant-webhook-secrets.

Create a private copy of templates/merchant-webhook-secrets.yaml.example alongside the
other reviewed Merchant config/secrets, set the key and apply the configuration first.
Build from the repository root (the context includes documentation for contract tests):

```powershell
docker build -f backend/merchant-service/Dockerfile -t swiftdrop/merchant-service:0.1.0 .
docker compose up --build -d merchant-service frontend
```

Load/push the reviewed image to your cluster registry and update image references as
needed. Apply the Merchant Deployment/Service only after Auth and the database/config
dependencies are available. Manifests are prepared; no cluster rollout is performed here.

## Verification

```powershell
mvn -f backend/merchant-service/pom.xml test
cd frontend
npm test
npm run build
```

Backend tests use isolated H2 and a recording transport to verify signatures, retry
timing/exhaustion, duplicate claims, lease recovery, cancellation, authorization,
ownership, rate limiting, and transactional order event creation. Frontend tests cover
orders/filter/details, settings, secret dismissal, test events, attempt details,
loading/error recovery and disabled/empty states. Live external HTTPS receiver delivery
and Kubernetes rollout require configured deployment environments.

Verified: **76 Merchant backend tests passed** (including 12 webhook/dashboard/
manifest tests), **101 frontend tests passed** (including 8 new operations tests),
and the Vite production build passed. The Kubernetes YAML was parsed and its
replica/resource/probe/secret/Service relationships checked in the backend suite.
kubectl client dry-run could not resolve API discovery because no local cluster
is configured; no rollout or live external receiver request was performed.

All seven requested independent implementation tasks are complete. Remaining team
integration: real parcel booking/tracking mapping and authoritative parcel status
event ingestion. Deployment setup still needs a private encryption key, a real public
HTTPS receiver, registry image configuration and the target Kubernetes environment.
