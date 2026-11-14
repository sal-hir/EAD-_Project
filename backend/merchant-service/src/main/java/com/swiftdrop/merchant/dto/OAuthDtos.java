package com.swiftdrop.merchant.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;

public final class OAuthDtos {
    private OAuthDtos() {}
    public record Create(@NotBlank @Size(max=80) String label,
                         @NotEmpty @Size(max=2) List<@NotNull @Pattern(regexp="merchant:read|orders:write") String> scopes) {}
    public record Summary(UUID id, UUID merchantId, String clientId, String label, List<String> scopes,
                          String status, Instant createdAt, Instant rotatedAt, Instant revokedAt) {}
    public record ClientList(UUID merchantId, boolean approved, List<Summary> clients) {}
    public record Created(Summary credential, String clientSecret) {
        @Override public String toString() { return "OAuthClient[redacted]"; }
    }
    public record Token(@JsonProperty("access_token") String accessToken,
                        @JsonProperty("token_type") String tokenType,
                        @JsonProperty("expires_in") long expiresIn, String scope) {
        @Override public String toString() { return "OAuthToken[redacted]"; }
    }
    public record Identity(UUID merchantId, UUID userId, String clientId, List<String> scopes,
                           Instant expiresAt, String audience) {}
}
