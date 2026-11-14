package com.swiftdrop.auth.controller;

import com.swiftdrop.auth.dto.AuthDtos.ApiResponse;
import com.swiftdrop.auth.exception.ApiException;
import com.swiftdrop.auth.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

/** Backend-only lookup for API-key authentication; never accepts browser credentials. */
@RestController
@RequestMapping("/api/v1/auth/internal/merchant-api/identity")
public class MerchantApiIdentityController {
    public record Lookup(@NotNull UUID userId) {}
    public record Identity(UUID id, String role, boolean active) {}
    private final UserRepository users;
    private final byte[] serviceKey;
    public MerchantApiIdentityController(UserRepository users, @Value("${app.merchant-service-token:}") String key) {
        this.users = users; this.serviceKey = key.getBytes(StandardCharsets.UTF_8);
    }
    @PostMapping
    public ResponseEntity<ApiResponse<Identity>> lookup(
            @RequestHeader(value = "X-SwiftDrop-Service-Key", required = false) String supplied,
            @Valid @RequestBody Lookup request) {
        if (serviceKey.length < 32) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Merchant integration is not configured");
        if (supplied == null || supplied.length() > 512 || !MessageDigest.isEqual(serviceKey, supplied.getBytes(StandardCharsets.UTF_8)))
            throw new ApiException(HttpStatus.FORBIDDEN, "Internal service authentication required");
        var user = users.findById(request.userId())
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Identity unavailable"));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(ApiResponse.ok(new Identity(user.getId(), user.getRole().name(), user.isActive())));
    }
}
