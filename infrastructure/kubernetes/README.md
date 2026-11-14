# Member 4: Kubernetes ConfigMaps and Secrets

This prepares Auth/Merchant configuration and credential templates. It does not
deploy a cluster, publish images, create Member 5's Merchant Deployment/Service,
or implement Member 10's Ingress/Helm release. Docker Compose is independent.

## Files and ownership

| File | Kubernetes object | Contents |
| --- | --- | --- |
| `auth-configmap.yaml` | `auth-config` | Auth database URLs/user, frontend URL, JWT issuer/TTL, Google callback, optional SMTP settings |
| `merchant-configmap.yaml` | `merchant-config` | Merchant database URLs/user, Auth URL, frontend URL, OAuth token TTL |
| `templates/auth-secrets.yaml.example` | `auth-secrets` | Auth DB password, JWT signing secret, optional Google/SMTP credentials |
| `templates/merchant-secrets.yaml.example` | `merchant-secrets` | Merchant DB password |
| `templates/merchant-integration-secrets.yaml.example` | `merchant-integration-secrets` | One backend service token consumed by Auth and Merchant |
| `auth-deployment.yaml` | Existing Auth Deployment/Service | References Auth configuration plus the shared integration Secret |

Member 4 owns the configuration/Secret contracts. Member 5 integrates them into
Merchant workloads, Member 7 maintains Compose, and Member 10 configures deployment
and Ingress/Helm. Existing Courier workload/storage manifests are not changed.
Templates contain placeholders only. Their `.yaml.example` suffix keeps them out
of normal YAML directory processing. Select the reviewed files for a release;
do not apply the entire directory as a deployment bundle.

## 1. Prepare private copies

From the repository root, for first-time setup:

```powershell
New-Item -ItemType Directory -Force .kubernetes-local | Out-Null
Copy-Item infrastructure/kubernetes/auth-configmap.yaml .kubernetes-local/auth-configmap.yaml
Copy-Item infrastructure/kubernetes/merchant-configmap.yaml .kubernetes-local/merchant-configmap.yaml
Copy-Item infrastructure/kubernetes/templates/auth-secrets.yaml.example .kubernetes-local/auth-secrets.yaml
Copy-Item infrastructure/kubernetes/templates/merchant-secrets.yaml.example .kubernetes-local/merchant-secrets.yaml
Copy-Item infrastructure/kubernetes/templates/merchant-integration-secrets.yaml.example .kubernetes-local/merchant-integration-secrets.yaml
```

Keep already configured local copies instead of overwriting them. Edit the copies
and replace every `YOUR-ENDPOINT` and `REPLACE_WITH_...` value. The root
`.kubernetes-local/` directory is Git-ignored. Never commit real credentials, even
base64-encoded ones: `stringData` is plaintext in your local manifest and Kubernetes
encodes it when creating the Secret. Restrict access to local copies and cluster
Secrets.

## 2. Set connections and credentials

Pooled Neon JDBC URLs are for application connections; direct URLs are for Flyway
in the same database. The pooled hostname contains `-pooler`; the direct one does
not. Preserve `sslmode=require&channelBinding=require` and keep passwords out of
JDBC URLs. Auth owns `auth`; Merchant owns `merchant`. Use the database roles
agreed with the database owner for each service's schema and migrations.

Unlike Compose, Kubernetes does not provide the Merchant-to-Auth database variable
fallbacks. Fill all Merchant connection fields explicitly, even when both services
use the same Neon database.

| Setting | Object | Configuration |
| --- | --- | --- |
| `AUTH_DB_URL`, `AUTH_MIGRATION_DB_URL`, `AUTH_DB_USER` | `auth-config` | Auth pooled/direct JDBC URLs and username |
| `AUTH_DB_PASSWORD` | `auth-secrets` | Auth database role password |
| `JWT_SECRET` | `auth-secrets` | At least 32 random bytes; same across Auth replicas |
| `MERCHANT_DB_URL`, `MERCHANT_MIGRATION_DB_URL`, `MERCHANT_DB_USER` | `merchant-config` | Merchant pooled/direct JDBC URLs and username |
| `MERCHANT_DB_PASSWORD` | `merchant-secrets` | Merchant database role password |
| `MERCHANT_SERVICE_TOKEN` | `merchant-integration-secrets` | Separate random value of at least 32 characters, shared by both backends |
| `FRONTEND_URL` | Both ConfigMaps | Same exact browser origin, e.g. `https://app.swiftdrop.example` |
| `COOKIE_SECURE` | `auth-config` | `"true"` for HTTPS; `"false"` for a localhost HTTP demo |
| `GOOGLE_REDIRECT_URI` | `auth-config` | Exact registered Google callback URL |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `auth-secrets` | Leave both empty to disable Google login |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_FROM`, SMTP flags | `auth-config` | Optional password-recovery email transport |
| `MAIL_USERNAME`, `MAIL_PASSWORD` | `auth-secrets` | Optional SMTP credentials |
| `AUTH_SERVICE_URL`, `AUTH_ALLOW_DOCKER_HTTP` | `merchant-config` | Backend Auth connection, described below |
| `MERCHANT_OAUTH_TOKEN_TTL_SECONDS` | `merchant-config` | Default `"900"`; supported range 60–3600 |

Generate JWT and integration secrets separately when new values are needed:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the results only into the private copies. When migrating an existing Auth
environment, retain its JWT secret if you intend to preserve the current signing
configuration. No placeholder secret is a usable release credential.

### Backend Auth URL

The demo template uses `http://auth-service:4000` and
`AUTH_ALLOW_DOCKER_HTTP: "true"` because the existing Auth ClusterIP Service speaks
HTTP. Despite its Docker-oriented name, the application flag permits HTTP only to
the exact `auth-service` hostname, which also resolves within the same Kubernetes
namespace. It does not permit arbitrary remote HTTP hosts.

For deployed HTTPS communication, Members 5/10 must provide a reachable trusted TLS
endpoint or the agreed service-mesh transport. Set the real HTTPS URL and the flag
to `"false"`. Merely changing the scheme to `https://auth-service:4000` will not
work: the current Auth container does not terminate TLS on that port.

### Credentials that stay in the database

Merchant API keys, OAuth client secrets and OAuth access tokens are generated by
Merchant Service and persisted only as hashes in its database. Do not duplicate
each merchant's credentials in Kubernetes Secrets or seed them from these files.
Merchant's opaque OAuth tokens need no new JWT signing key. The private
`MERCHANT_SERVICE_TOKEN` must never be exposed through frontend VITE variables.

## 3. Member 5 workload references

The existing Auth Deployment now uses:

```yaml
envFrom:
  - configMapRef:
      name: auth-config
  - secretRef:
      name: auth-secrets
  - secretRef:
      name: merchant-integration-secrets
```

Member 5 should add this fragment under their Merchant container. It is not a
standalone resource to apply:

```yaml
ports:
  - containerPort: 4001
envFrom:
  - configMapRef:
      name: merchant-config
  - secretRef:
      name: merchant-secrets
  - secretRef:
      name: merchant-integration-secrets
```

Use Deployment/Service name `merchant-service` and target port 4001 for the example
commands below. Auth/ConfigMaps/Secrets/Merchant must all use the same namespace.
The shared Secret reference is required: create it before updating Auth. Never
give the Merchant Pod Auth's JWT signing secret or database password.

Member 5 owns images, replicas and resource limits. A read-only filesystem should
provide writable `/tmp`, as the existing Auth manifest does; Merchant needs no
persistent filesystem. Member 8 coordinates health probes:

| Service | Readiness | Liveness |
| --- | --- | --- |
| Auth port 4000 | `/actuator/health/readiness` | `/actuator/health/liveness` |
| Merchant port 4001 | `/actuator/health/readiness` | `/actuator/health/liveness` |

## 4. Apply when the cluster and workloads are ready

Preparing files does not deploy anything or change your Kubernetes context. The
following are operator-run commands after reviewing placeholders, images and
workload integration. Use the same namespace throughout:

```powershell
kubectl config current-context
kubectl create namespace swiftdrop --dry-run=client -o yaml | kubectl apply -f -

kubectl -n swiftdrop apply -f .kubernetes-local/auth-secrets.yaml
kubectl -n swiftdrop apply -f .kubernetes-local/merchant-secrets.yaml
kubectl -n swiftdrop apply -f .kubernetes-local/merchant-integration-secrets.yaml
kubectl -n swiftdrop apply -f .kubernetes-local/auth-configmap.yaml
kubectl -n swiftdrop apply -f .kubernetes-local/merchant-configmap.yaml

kubectl -n swiftdrop get configmap auth-config merchant-config
kubectl -n swiftdrop get secret auth-secrets merchant-secrets merchant-integration-secrets
```

Apply configured workloads through the team's release workflow. The existing Auth
Deployment needs your published registry image; this task does not supply Member
5's Merchant Deployment/Service.

Alternatively, create Secrets from ignored env files using `kubectl create secret
generic NAME --from-env-file=PRIVATE_FILE --dry-run=client -o yaml | kubectl apply
-f -`, with the same keys/object names and namespace. Avoid actual credentials in
`--from-literal` command arguments or checked-in Helm values.

## 5. Updates and runtime verification

Existing Pods do not reload environment variables when ConfigMaps/Secrets change.
Restart the relevant existing Deployments after applying updates:

```powershell
kubectl -n swiftdrop rollout restart deployment/auth-service deployment/merchant-service
kubectl -n swiftdrop rollout status deployment/auth-service
kubectl -n swiftdrop rollout status deployment/merchant-service
kubectl -n swiftdrop get pods
```

Coordinate both rollouts when rotating the integration token: approval and machine
identity checks may briefly fail while replicas load different values. Keep Auth
replicas' signing configuration consistent. Databases retain sessions and Merchant
token hashes; service restarts do not replace that state. Flyway validates/migrates
only service-owned schemas and uses database migration locking.

When both Services exist, port-forward them in separate terminals:

```powershell
kubectl -n swiftdrop port-forward service/auth-service 14000:4000
kubectl -n swiftdrop port-forward service/merchant-service 14001:4001
```

Check `http://localhost:14000/actuator/health/readiness` and
`http://localhost:14001/actuator/health/readiness`. These check backend health;
browser login also needs the agreed frontend origin, cookies/Ingress and frontend
build-time API URLs. Repeat the acceptance flows in [Merchant setup](../../backend/merchant-service/README.md),
[API keys](../../docs/merchant-api-keys.md) and [OAuth](../../docs/merchant-oauth.md).

Member 10's HTTPS Ingress routes Auth user APIs, `/oauth2` and `/login/oauth2` to
Auth, and `/api/v1/merchants`, `/api/v1/merchant-api`, `/api/v1/oauth/token` to Merchant.
Restrict public access to `/api/v1/auth/internal/**` and Actuator. Frontend
`VITE_API_URL` / `VITE_MERCHANT_API_URL` values are build-time settings: a ConfigMap
in the Nginx Pod does not rewrite compiled JavaScript. Trust forwarded headers only
if Ingress strips client-supplied forwarding headers.

## Validation boundary and references

Template checks cover YAML structure, string-valued data, application environment
names, secret separation and shared-Secret references. Kubernetes API/server-side
validation and live rollout still require the team's cluster and Merchant workload
manifests. No cluster deployment is claimed by these offline checks.

On 2026-11-14, both ConfigMaps and all three Secret templates passed the structural,
environment-name and consumer-reference checks. `kubectl` client dry-run generators
also produced matching key/value data for all five objects using an empty local
kubeconfig; no cluster was contacted. The ignored private-copy paths were verified
against `.gitignore`.

Official references: [ConfigMaps](https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/),
[Secret manifests/stringData](https://kubernetes.io/docs/tasks/configmap-secret/managing-secret-using-config-file/),
[Secret environment variables](https://kubernetes.io/docs/tasks/inject-data-application/distribute-credentials-secure/).
