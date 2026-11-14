CREATE TABLE oauth_clients (
    id UUID PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES merchant.applications(id) ON DELETE CASCADE,
    client_identifier VARCHAR(60) NOT NULL UNIQUE,
    label VARCHAR(80) NOT NULL,
    secret_hash VARCHAR(64) NOT NULL,
    scopes VARCHAR(200) NOT NULL,
    status VARCHAR(10) NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED')),
    credential_version BIGINT NOT NULL DEFAULT 0,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    rotated_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID,
    revoked_at TIMESTAMP WITH TIME ZONE,
    CHECK ((status = 'ACTIVE' AND revoked_at IS NULL AND revoked_by IS NULL)
        OR (status = 'REVOKED' AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL))
);
CREATE INDEX oauth_clients_merchant ON oauth_clients(merchant_id, created_at);
CREATE TABLE oauth_access_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES merchant.oauth_clients(id) ON DELETE CASCADE,
    credential_version BIGINT NOT NULL,
    scopes VARCHAR(200) NOT NULL,
    audience VARCHAR(80) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX oauth_tokens_client ON oauth_access_tokens(client_id);
CREATE INDEX oauth_tokens_expiry ON oauth_access_tokens(expires_at);
CREATE TABLE oauth_client_audit (
    id UUID PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES merchant.oauth_clients(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('CREATED', 'SECRET_ROTATED', 'REVOKED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
