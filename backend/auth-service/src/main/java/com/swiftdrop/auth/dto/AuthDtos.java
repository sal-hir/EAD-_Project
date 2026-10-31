package com.swiftdrop.auth.dto;

import com.swiftdrop.auth.entity.Role;
import com.swiftdrop.auth.entity.User;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.UUID;

public final class AuthDtos {
    private AuthDtos() {}
    public record RegisterRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 8, max = 72) @Pattern(regexp = "[\\x20-\\x7E]+", message = "must contain printable ASCII characters") String password,
        @Size(max = 30) @Pattern(regexp = "[+0-9 ()-]*", message = "must be a valid phone number") String phone,
        @Pattern(regexp = "CUSTOMER", message = "public registration only supports CUSTOMER") String role) {}
    public record LoginRequest(@NotBlank @Email @Size(max = 254) String email,
                               @NotBlank @Size(max = 72) String password) {}
    public record ExchangeRequest(@NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{43}") String code,
                                  @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{43,128}") String verifier) {}
    public record Profile(UUID id, String name, String email, String phone, Role role, boolean active,
                          Instant createdAt, Instant updatedAt) {
        public static Profile from(User u) {
            return new Profile(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getRole(),
                u.isActive(), u.getCreatedAt(), u.getUpdatedAt());
        }
    }
    public record LoginResult(String token, String tokenType, long expiresIn, Instant expiresAt, Profile user, Role role) {}
    public record ApiResponse<T>(boolean success, T data) {
        public static <T> ApiResponse<T> ok(T data) { return new ApiResponse<>(true, data); }
    }
}
