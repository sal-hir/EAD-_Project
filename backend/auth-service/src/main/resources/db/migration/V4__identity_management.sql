ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE identity_admin_guard (id INTEGER PRIMARY KEY CHECK (id = 1), bootstrapped BOOLEAN NOT NULL);
INSERT INTO identity_admin_guard (id, bootstrapped) VALUES (1, FALSE);
CREATE TABLE identity_audit (
    id UUID PRIMARY KEY, actor_id UUID, target_id UUID NOT NULL,
    action VARCHAR(40) NOT NULL, detail VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX identity_audit_target ON identity_audit(target_id, created_at);
CREATE TABLE identity_actions (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('ACTIVATION','GOOGLE_LINK')),
    session_id UUID REFERENCES refresh_sessions(id) ON DELETE CASCADE,
    challenge VARCHAR(43), expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX identity_actions_expiry ON identity_actions(expires_at);
