CREATE TABLE applications (
    id UUID PRIMARY KEY, user_id UUID NOT NULL UNIQUE,
    business_name VARCHAR(120) NOT NULL, trading_name VARCHAR(120), registration_number VARCHAR(80),
    category VARCHAR(60) NOT NULL, contact_name VARCHAR(120) NOT NULL,
    business_email VARCHAR(254) NOT NULL, phone VARCHAR(30) NOT NULL,
    address VARCHAR(500) NOT NULL, district VARCHAR(120) NOT NULL,
    website VARCHAR(300), additional_details VARCHAR(2000),
    status VARCHAR(20) NOT NULL CHECK(status IN ('PENDING','APPROVING','APPROVED','REJECTED')),
    version BIGINT NOT NULL, submitted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE, reviewed_by UUID,
    rejection_reason VARCHAR(1000), sync_error VARCHAR(200)
);
CREATE INDEX merchant_review_queue ON applications(status,submitted_at);
CREATE TABLE approval_audit (
    id UUID PRIMARY KEY, application_id UUID NOT NULL REFERENCES applications(id),
    actor_id UUID NOT NULL, action VARCHAR(40) NOT NULL, detail VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX merchant_application_audit ON approval_audit(application_id,created_at);
