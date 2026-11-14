CREATE SCHEMA IF NOT EXISTS tracking;

CREATE TABLE IF NOT EXISTS tracking.parcels (
    id UUID PRIMARY KEY,
    tracking_number VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    origin_city VARCHAR(100) NOT NULL,
    destination_city VARCHAR(100) NOT NULL,
    weight_kg DOUBLE PRECISION DEFAULT 1.0,
    estimated_delivery TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tracking.tracking_events (
    id UUID PRIMARY KEY,
    parcel_id UUID NOT NULL REFERENCES tracking.parcels(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    city VARCHAR(100),
    description VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tracking_number ON tracking.parcels(tracking_number);
CREATE INDEX IF NOT EXISTS idx_tracking_events_parcel_id ON tracking.tracking_events(parcel_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_timestamp ON tracking.tracking_events(timestamp ASC);

-- Seed initial parcels for demonstration and automated testing
INSERT INTO tracking.parcels (id, tracking_number, status, origin_city, destination_city, weight_kg, estimated_delivery, created_at, updated_at)
VALUES 
('a0000000-0000-0000-0000-000000000001', 'SWIFT-1001-LK', 'IN_TRANSIT', 'Colombo', 'Kandy', 2.5, CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '5 hours', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
('a0000000-0000-0000-0000-000000000002', 'SWIFT-1002-LK', 'OUT_FOR_DELIVERY', 'Galle', 'Colombo', 1.2, CURRENT_TIMESTAMP + INTERVAL '3 hours', CURRENT_TIMESTAMP - INTERVAL '8 hours', CURRENT_TIMESTAMP - INTERVAL '30 minutes'),
('a0000000-0000-0000-0000-000000000003', 'SWIFT-1003-LK', 'DELIVERED', 'Negombo', 'Jaffna', 4.0, CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '2 hours')
ON CONFLICT (tracking_number) DO NOTHING;

INSERT INTO tracking.tracking_events (id, parcel_id, status, city, description, timestamp)
VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'CREATED', 'Colombo', 'Parcel registered in system', CURRENT_TIMESTAMP - INTERVAL '5 hours'),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'PICKED_UP', 'Colombo', 'Courier collected package from origin', CURRENT_TIMESTAMP - INTERVAL '3 hours'),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'IN_TRANSIT', 'Colombo Central Hub', 'Package sorted and dispatched to Kandy hub', CURRENT_TIMESTAMP - INTERVAL '1 hour'),

('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'CREATED', 'Galle', 'Parcel registered in system', CURRENT_TIMESTAMP - INTERVAL '8 hours'),
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'PICKED_UP', 'Galle', 'Collected from sender', CURRENT_TIMESTAMP - INTERVAL '6 hours'),
('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'IN_TRANSIT', 'Southern Expressway Hub', 'Transferred to Western Province distribution center', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'OUT_FOR_DELIVERY', 'Colombo', 'Courier is on the way to recipient address', CURRENT_TIMESTAMP - INTERVAL '30 minutes')
ON CONFLICT (id) DO NOTHING;
