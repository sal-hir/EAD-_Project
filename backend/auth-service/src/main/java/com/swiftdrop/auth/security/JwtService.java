package com.swiftdrop.auth.security;

import com.swiftdrop.auth.dto.AuthDtos.*;
import com.swiftdrop.auth.entity.User;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
    private final JwtEncoder encoder;
    private final String issuer;
    private final long ttl;
    public JwtService(JwtEncoder encoder, @Value("${app.jwt-issuer}") String issuer,
                      @Value("${app.jwt-ttl-seconds}") long ttl) {
        if (ttl < 60 || ttl > 3600) throw new IllegalArgumentException("JWT TTL must be between 60 and 3600 seconds");
        this.encoder = encoder; this.issuer = issuer; this.ttl = ttl;
    }
    public LoginResult issue(User user) {
        return issue(user, null);
    }
    public LoginResult issue(User user, java.util.UUID sessionId) {
        Instant now = Instant.now();
        JwtClaimsSet.Builder builder = JwtClaimsSet.builder().issuer(issuer).subject(user.getId().toString())
            .audience(List.of("swiftdrop-api")).issuedAt(now).expiresAt(now.plusSeconds(ttl))
            .id(java.util.UUID.randomUUID().toString());
        if (sessionId != null) builder.claim("sid", sessionId.toString());
        JwtClaimsSet claims = builder.build();
        String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return new LoginResult(token, "Bearer", ttl, now.plusSeconds(ttl), Profile.from(user), user.getRole());
    }
}
