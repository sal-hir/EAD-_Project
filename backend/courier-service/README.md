# Courier Task Board & Proof of Delivery Service (`courier-service`)

**Module Component:** Member 6 Responsibility  
**Runtime:** Java 21 / Spring Boot 3.5.16  
**Port:** `4003`  
**Database Schema:** `courier` (Neon PostgreSQL managed with Flyway)  

---

## 1. Domain Overview & Features
1. **Courier Daily Task Board**: Retrieve assigned deliveries for the authenticated courier (`GET /api/v1/couriers/my-deliveries`).
2. **Delivery State Machine (State Pattern)**: Strict validation of lifecycle status transitions:
   - `PENDING_PICKUP` $\rightarrow$ `PICKED_UP` $\rightarrow$ `IN_TRANSIT` $\rightarrow$ `OUT_FOR_DELIVERY` $\rightarrow$ `DELIVERED` / `FAILED`.
   - Prevents invalid state jumps (e.g. `PENDING_PICKUP` $\rightarrow$ `DELIVERED` is rejected with `400 Bad Request`).
3. **Mandatory Failure Reason**: Marking status as `FAILED` requires an explicit failure reason (`400 Bad Request` if omitted).
4. **Proof of Delivery Uploads**: Multipart image upload endpoint (`POST /api/v1/uploads/proof`) storing images in persistent Docker and Kubernetes volumes (`/app/uploads`).
5. **Courier Isolation Security (Key Rubric Requirement)**:
   - Enforces that Courier A **cannot** view or update parcels assigned to Courier B (`403 Forbidden`).
   - Covered by automated integration test `courierIsolationTest_courierBCannotUpdateCourierAParcel`.

---

## 2. API Contract Specification

| Method | Path | Description | Security |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/couriers/my-deliveries` | Returns assigned deliveries and courier profile | Bearer token (`ROLE_COURIER`) |
| `PATCH` | `/api/v1/couriers/availability` | Toggles active availability (`isAvailable: true/false`) | Bearer token (`ROLE_COURIER`) |
| `PATCH` | `/api/v1/couriers/parcels/{id}/status` | Advances parcel delivery state | Bearer token (`ROLE_COURIER`) |
| `POST` | `/api/v1/uploads/proof` | Uploads photo proof of delivery (Multipart) | Bearer token (`ROLE_COURIER`) |
| `GET` | `/actuator/health/readiness` | Liveness and DB readiness probe | Public |

---

## 3. DevOps & Storage Configuration
- **Docker Volume**: Mounted to `/app/uploads` via `uploads_data` in root `docker-compose.yml`.
- **Kubernetes Persistent Volume**:
  - `infrastructure/kubernetes/courier-pv-pvc.yaml`: Declares `PersistentVolume` and `PersistentVolumeClaim` requesting 1Gi persistent disk.
  - `infrastructure/kubernetes/courier-deployment.yaml`: Mounts `courier-proof-pvc` into `/app/uploads`.

---

## 4. Verification & Testing
Run tests via Maven:
```powershell
mvn test -f backend/courier-service/pom.xml
```
### Verified Test Cases:
1. `courierCanViewAssignedDeliveries` — Loads assigned deliveries for active courier.
2. `courierIsolationTest_courierBCannotUpdateCourierAParcel` — Verifies unauthorized couriers receive HTTP `403 Forbidden`.
3. `courierCanUpdateOwnParcelStatusStepByStep` — Validates sequential progression from `PENDING_PICKUP` to `DELIVERED`.
4. `invalidStatusTransitionIsRejected` — Rejects invalid skipped state transitions.
5. `markingAsFailedRequiresMandatoryFailureReason` — Rejects failed status missing reason.
6. `courierCanToggleAvailability` — Updates duty availability.
7. `proofPhotoUploadSucceeds` — Validates multipart image upload and relative URL generation.

