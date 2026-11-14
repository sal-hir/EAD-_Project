CREATE TABLE orders (
    id UUID PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    merchant_order_id VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_json TEXT NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('PENDING_BOOKING')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE (merchant_id, merchant_order_id),
    UNIQUE (merchant_id, idempotency_key)
);
CREATE INDEX merchant_orders_created ON orders(merchant_id, created_at, id);
