CREATE TABLE webhook_settings (
    merchant_id UUID PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
    url VARCHAR(2000) NOT NULL,
    enabled BOOLEAN NOT NULL,
    secret_cipher TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    event_key VARCHAR(180) NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    payload TEXT NOT NULL,
    target_url VARCHAR(2000) NOT NULL,
    secret_cipher TEXT NOT NULL,
    state VARCHAR(20) NOT NULL CHECK(state IN ('PENDING','SENDING','RETRY','DELIVERED','FAILED','CANCELLED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(merchant_id,event_key)
);
CREATE INDEX webhook_due ON webhook_deliveries(state,next_attempt_at);
CREATE INDEX webhook_owned ON webhook_deliveries(merchant_id,created_at);
CREATE TABLE webhook_attempts (
    id UUID PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES webhook_deliveries(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    response_status INTEGER,
    outcome VARCHAR(80) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(delivery_id,attempt_number)
);
