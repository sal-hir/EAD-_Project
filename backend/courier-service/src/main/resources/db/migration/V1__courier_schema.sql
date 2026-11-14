CREATE SCHEMA IF NOT EXISTS courier;

CREATE TABLE IF NOT EXISTS courier.couriers (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    name VARCHAR(150),
    phone VARCHAR(50),
    vehicle_type VARCHAR(50) NOT NULL,
    license_no VARCHAR(50) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    zone VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courier.parcels (
    id UUID PRIMARY KEY,
    tracking_number VARCHAR(64) NOT NULL UNIQUE,
    courier_id UUID REFERENCES courier.couriers(id),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_PICKUP',
    pickup_address TEXT,
    pickup_city VARCHAR(100),
    dropoff_address TEXT,
    dropoff_city VARCHAR(100),
    recipient_name VARCHAR(150),
    recipient_phone VARCHAR(50),
    recipient_email VARCHAR(150),
    weight_kg DOUBLE PRECISION,
    size VARCHAR(20),
    note TEXT,
    proof_image_url TEXT,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS courier.parcel_status_history (
    id UUID PRIMARY KEY,
    parcel_id UUID NOT NULL REFERENCES courier.parcels(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    note TEXT,
    proof_image_url TEXT,
    failure_reason TEXT,
    updated_by UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_courier_user_id ON courier.couriers(user_id);
CREATE INDEX IF NOT EXISTS idx_parcel_courier_id ON courier.parcels(courier_id);
CREATE INDEX IF NOT EXISTS idx_parcel_status ON courier.parcels(status);
CREATE INDEX IF NOT EXISTS idx_history_parcel_id ON courier.parcel_status_history(parcel_id);

