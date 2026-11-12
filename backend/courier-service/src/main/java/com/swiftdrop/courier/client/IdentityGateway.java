package com.swiftdrop.courier.client;

import java.util.UUID;

public interface IdentityGateway {
    record Caller(UUID id, String role, String email, String name, String phone) {}
    Caller validate(String bearer);
}

