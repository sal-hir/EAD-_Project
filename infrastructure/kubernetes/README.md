# Auth deployment foundation

Replace the ConfigMap's Neon endpoint placeholders with your connection settings.
AUTH_DB_URL uses the pooled JDBC URL; AUTH_MIGRATION_DB_URL uses the direct URL
for the same database. Set AUTH_DB_USER to the database role and put its password
in auth-secrets. Flyway owns only the auth schema; existing tables in other
schemas remain untouched.

Build and publish the service image to your own registry, then replace the image
in auth-deployment.yaml. The runtime needs no persistent filesystem.

Create a local, ignored file named .env.kubernetes with AUTH_DB_PASSWORD and
JWT_SECRET (a random value of at least 32 bytes). Add GOOGLE_CLIENT_ID and
GOOGLE_CLIENT_SECRET if enabling Google. Never commit that file.

```powershell
kubectl create secret generic auth-secrets --from-env-file=.env.kubernetes
kubectl apply -f infrastructure/kubernetes/auth-configmap.yaml
kubectl apply -f infrastructure/kubernetes/auth-deployment.yaml
kubectl rollout status deployment/auth-service
```

Set real HTTPS frontend and OAuth callback URLs in the ConfigMap.
Expose the frontend with your cluster's existing Ingress. Route /api/v1/auth,
/oauth2 and /login/oauth2 on the API host to auth-service:4000. Restrict external
Actuator access at Ingress. No API gateway or discovery server is required.
Do not enable forwarded-header trust unless Ingress strips client-supplied
forwarding headers. GOOGLE_REDIRECT_URI is explicit, so it does not depend on them.

All replicas must use the same database, JWT secret and issuer. Spring Session
JDBC stores short-lived OAuth state across replicas; database row locks enforce
single-use exchange. No sticky sessions are required. Run Flyway migrations once
as a release step when scaling deployments beyond this foundation, using the
same image with traffic disabled, or retain Flyway's database migration locking.
