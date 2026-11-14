CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES merchant.applications(id) ON DELETE CASCADE,
    label VARCHAR(80) NOT NULL,
    key_prefix VARCHAR(24) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(10) NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED')),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_by UUID,
    revoked_at TIMESTAMP WITH TIME ZONE,
    CHECK ((status = 'ACTIVE' AND revoked_at IS NULL AND revoked_by IS NULL)
        OR (status = 'REVOKED' AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL))
);
CREATE INDEX api_keys_merchant ON api_keys(merchant_id, created_at);
CREATE TABLE api_key_audit (
    id UUID PRIMARY KEY,
    key_id UUID NOT NULL REFERENCES merchant.api_keys(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('CREATED', 'REVOKED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
