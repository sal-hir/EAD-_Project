package com.swiftdrop.auth.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "refresh_sessions")
public class RefreshSession {
    @Id private UUID id;
    @Column(nullable = false) private UUID userId;
    @Column(nullable = false) private Instant createdAt;
    @Column(nullable = false) private Instant expiresAt;
    private Instant revokedAt;
    protected RefreshSession() {}
    public RefreshSession(UUID userId, Instant expiresAt) {
        this.id = UUID.randomUUID(); this.userId = userId;
        this.createdAt = Instant.now(); this.expiresAt = expiresAt;
    }
    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public Instant getExpiresAt() { return expiresAt; }
    public boolean isActive() { return revokedAt == null && expiresAt.isAfter(Instant.now()); }
    public void revoke() { if (revokedAt == null) revokedAt = Instant.now(); }
}
