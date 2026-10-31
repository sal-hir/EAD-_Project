CREATE TABLE refresh_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX refresh_sessions_expiry ON refresh_sessions(expires_at);
CREATE INDEX refresh_sessions_user ON refresh_sessions(user_id);
CREATE TABLE refresh_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES refresh_sessions(id) ON DELETE CASCADE,
    consumed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX refresh_tokens_session ON refresh_tokens(session_id);
