package com.swiftdrop.auth.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "oauth_codes")
public class OAuthCode {
    @Id @Column(length = 64) private String codeHash;
    @Column(nullable = false) private UUID userId;
    @Column(nullable = false, length = 43) private String challenge;
    @Column(nullable = false) private Instant expiresAt;
    protected OAuthCode() {}
    public OAuthCode(String codeHash, UUID userId, String challenge, Instant expiresAt) {
        this.codeHash = codeHash; this.userId = userId; this.challenge = challenge; this.expiresAt = expiresAt;
    }
    public UUID getUserId() { return userId; }
    public String getChallenge() { return challenge; }
    public Instant getExpiresAt() { return expiresAt; }
}
