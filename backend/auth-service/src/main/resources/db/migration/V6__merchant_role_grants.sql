CREATE TABLE merchant_role_grants (
    application_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL, granted_at TIMESTAMP WITH TIME ZONE NOT NULL
);
