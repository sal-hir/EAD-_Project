package com.swiftdrop.auth.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "refresh_tokens")
public class RefreshToken {
    @Id @Column(length = 64) private String tokenHash;
    @Column(nullable = false) private UUID sessionId;
    private Instant consumedAt;
    protected RefreshToken() {}
    public RefreshToken(String tokenHash, UUID sessionId) { this.tokenHash = tokenHash; this.sessionId = sessionId; }
    public boolean isConsumed() { return consumedAt != null; }
    public void consume() { consumedAt = Instant.now(); }
}
