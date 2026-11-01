CREATE TABLE password_reset_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX password_reset_expiry ON password_reset_tokens(expires_at);
CREATE TABLE recovery_rate_guard (id INTEGER PRIMARY KEY CHECK (id = 1));
INSERT INTO recovery_rate_guard(id) VALUES (1);
CREATE TABLE recovery_rate_limits (
    bucket_hash VARCHAR(64) PRIMARY KEY, hits INTEGER NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
