package com.swiftdrop.merchant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ApiKeyDtos {
    private ApiKeyDtos() {}
    public record Create(@NotBlank @Size(max = 80) String label) {}
    public record Summary(UUID id, UUID merchantId, String label, String prefix,
                          String status, Instant createdAt, Instant revokedAt) {}
    public record KeyList(UUID merchantId, boolean approved, List<Summary> keys) {}
    public record Created(Summary credential, String apiKey) {
        @Override public String toString() { return "Created[redacted]"; }
    }
    public record Identity(UUID merchantId, UUID userId, UUID keyId) {}
}
