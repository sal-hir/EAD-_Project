package com.swiftdrop.auth.dto;

import com.swiftdrop.auth.entity.Role;
import com.swiftdrop.auth.dto.AuthDtos.Profile;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;

public final class IdentityDtos {
    private IdentityDtos() {}
    public record ProvisionRequest(@NotBlank @Size(max=120) String name,
        @NotBlank @Email @Size(max=254) String email,
        @Size(max=30) @Pattern(regexp="[+0-9 ()-]*") String phone,
        @NotNull Role role, @NotNull Boolean active) {}
    public record StatusRequest(@NotNull Boolean active) {}
    public record RoleRequest(@NotNull Role role) {}
    public record PasswordRequest(@NotBlank @Size(min=8,max=72)
        @Pattern(regexp="[\\x20-\\x7E]+",message="must contain printable ASCII characters") String password) {
        @Override public String toString(){return "PasswordRequest[redacted]";}
    }
    public record ActivationRequest(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String code,
        @NotBlank @Size(min=8,max=72) @Pattern(regexp="[\\x20-\\x7E]+") String password) {
        @Override public String toString(){return "ActivationRequest[redacted]";}
    }
    public record Activation(Profile user, String activationUrl, Instant expiresAt) {
        @Override public String toString(){return "Activation[redacted]";}
    }
    public record UserPage(List<Profile> users, int page, long total, int pages) {}
    public record Audit(UUID id, UUID actorId, UUID targetId, String action, String detail, Instant createdAt) {}
}
