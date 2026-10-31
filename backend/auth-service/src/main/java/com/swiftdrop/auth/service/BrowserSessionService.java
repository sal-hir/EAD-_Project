package com.swiftdrop.auth.service;

import com.swiftdrop.auth.dto.AuthDtos.LoginResult;
import com.swiftdrop.auth.entity.*;
import com.swiftdrop.auth.exception.ApiException;
import com.swiftdrop.auth.repository.*;
import com.swiftdrop.auth.security.JwtService;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.scheduling.annotation.Scheduled;

@Service
public class BrowserSessionService {
    public record SessionResult(LoginResult login, String refreshToken, Instant expiresAt) {}
    private final RefreshSessionRepository sessions;
    private final RefreshTokenRepository tokens;
    private final UserRepository users;
    private final JwtService jwt;
    private final long lifetime;
    public BrowserSessionService(RefreshSessionRepository sessions, RefreshTokenRepository tokens,
            UserRepository users, JwtService jwt, @Value("${app.refresh-ttl-seconds:604800}") long lifetime) {
        if (lifetime < 60 || lifetime > 2592000) throw new IllegalArgumentException("Refresh lifetime must be between 60 seconds and 30 days");
        this.sessions = sessions; this.tokens = tokens; this.users = users; this.jwt = jwt; this.lifetime = lifetime;
    }
    private static ApiException denied() { return new ApiException(HttpStatus.UNAUTHORIZED, "Session expired or revoked; please sign in again"); }
    public static String hash(String raw) { return HexFormat.of().formatHex(OAuthService.digest(raw)); }
    private Optional<UUID> sessionId(String raw) {
        return raw != null && raw.matches("[A-Za-z0-9_-]{43}") ? tokens.findSessionId(hash(raw)) : Optional.empty();
    }
    private SessionResult issue(User user, RefreshSession session) {
        byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tokens.save(new RefreshToken(hash(raw), session.getId()));
        return new SessionResult(jwt.issue(user, session.getId()), raw, session.getExpiresAt());
    }
    @Transactional
    public SessionResult start(UUID userId, String previousToken) {
        revoke(previousToken);
        User user = users.findById(userId).filter(User::isActive).orElseThrow(BrowserSessionService::denied);
        RefreshSession session = sessions.save(new RefreshSession(userId, Instant.now().plusSeconds(lifetime)));
        return issue(user, session);
    }
    // Revocation after replay must commit even though the client receives a 401.
    @Transactional(noRollbackFor = ApiException.class)
    public SessionResult rotate(String raw) {
        UUID id = sessionId(raw).orElseThrow(BrowserSessionService::denied);
        RefreshSession session = sessions.lockById(id).orElseThrow(BrowserSessionService::denied);
        RefreshToken token = tokens.findById(hash(raw)).orElseThrow(BrowserSessionService::denied);
        if (!session.isActive() || token.isConsumed()) {
            session.revoke(); throw denied();
        }
        User user = users.findById(session.getUserId()).filter(User::isActive).orElse(null);
        if (user == null) { session.revoke(); throw denied(); }
        token.consume();
        return issue(user, session);
    }
    @Transactional
    public void revoke(String raw) {
        sessionId(raw).flatMap(sessions::lockById).ifPresent(RefreshSession::revoke);
    }
    @Scheduled(cron = "0 0 * * * *") @Transactional
    public void removeExpiredSessions() { sessions.deleteExpired(Instant.now()); }
}
