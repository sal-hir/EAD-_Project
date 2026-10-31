CREATE TABLE users (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(100),
    phone VARCHAR(30),
    role VARCHAR(20) NOT NULL CHECK (role IN ('CUSTOMER','MERCHANT','COURIER','DISPATCHER','ADMIN')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    google_subject VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE TABLE oauth_codes (
    code_hash VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    challenge VARCHAR(43) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX oauth_codes_expiry ON oauth_codes(expires_at);
