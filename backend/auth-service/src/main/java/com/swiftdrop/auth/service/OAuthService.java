package com.swiftdrop.auth.service;

import com.swiftdrop.auth.dto.AuthDtos.LoginResult;
import com.swiftdrop.auth.entity.*;
import com.swiftdrop.auth.exception.ApiException;
import com.swiftdrop.auth.repository.*;
import com.swiftdrop.auth.security.JwtService;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;

@Service
public class OAuthService {
    private final UserRepository users;
    private final OAuthCodeRepository codes;
    private final JwtService jwt;
    private final IdentityService identities;
    private final RefreshSessionRepository sessions;
    private final PasswordEncoder passwords;
    public OAuthService(UserRepository users, OAuthCodeRepository codes, JwtService jwt, IdentityService identities,
            RefreshSessionRepository sessions, PasswordEncoder passwords) {
        this.users = users; this.codes = codes; this.jwt = jwt;this.identities=identities;this.sessions=sessions;this.passwords=passwords;
    }
    public static byte[] digest(String value) {
        try { return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.US_ASCII)); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    public static String challenge(String verifier) { return Base64.getUrlEncoder().withoutPadding().encodeToString(digest(verifier)); }
    private static String hash(String code) { return HexFormat.of().formatHex(digest(code)); }
    private static ApiException denied() { return new ApiException(HttpStatus.UNAUTHORIZED, "Google authentication unavailable for this identity"); }
    private User linkingUser(UUID userId,UUID sessionId) {
        User user=users.lockById(userId).filter(User::isActive).orElseThrow(OAuthService::denied);
        if(sessionId==null||sessions.lockById(sessionId).filter(s->s.isActive()&&s.getUserId().equals(userId)).isEmpty())throw denied();
        return user;
    }
    @Transactional public String prepareLink(UUID userId,UUID sessionId,String password,String challenge) {
        User user=linkingUser(userId,sessionId);
        if(user.getPasswordHash()==null||!passwords.matches(password,user.getPasswordHash()))throw denied();
        if(user.getGoogleSubject()!=null)throw new ApiException(HttpStatus.CONFLICT,"A Google account is already connected");
        return identities.issueAction(userId,"GOOGLE_LINK",sessionId,challenge,Instant.now().plusSeconds(300));
    }
    @Transactional public IdentityService.Action beginLink(String token,String challenge) {
        var action=identities.consumeAction(token,"GOOGLE_LINK");
        if(!MessageDigest.isEqual(action.challenge().getBytes(StandardCharsets.US_ASCII),challenge.getBytes(StandardCharsets.US_ASCII)))throw denied();
        linkingUser(action.userId(),action.sessionId());return action;
    }
    @Transactional public User completeLink(UUID userId,UUID sessionId,String subject,String email,Boolean verified) {
        User user=linkingUser(userId,sessionId);
        if(!Boolean.TRUE.equals(verified)||subject==null||subject.isBlank()||email==null||!user.getEmail().equals(AuthService.normalize(email)))throw denied();
        if(user.getGoogleSubject()!=null||users.findByGoogleSubject(subject).isPresent())throw new ApiException(HttpStatus.CONFLICT,"Google identity is already connected");
        user.setGoogleSubject(subject);users.saveAndFlush(user);
        identities.audit(userId,userId,"GOOGLE_LINKED","Password reauthentication and verified OIDC identity");
        return user;
    }
    @Transactional
    public User googleUser(String subject, String email, Boolean verified, String name) {
        if (!Boolean.TRUE.equals(verified) || subject == null || subject.isBlank() || email == null || email.isBlank()) throw denied();
        Optional<User> existing = users.findByGoogleSubject(subject);
        if (existing.isPresent()) {
            if (!existing.get().isActive()) throw denied();
            return existing.get();
        }
        // Email matching alone cannot attach a new identity to an existing password account.
        // Explicit authenticated linking is deliberately deferred.
        String normalized = AuthService.normalize(email);
        if (users.existsByEmail(normalized)) throw denied();
        String displayName = name == null || name.isBlank() ? "SwiftDrop customer" : name.strip();
        User user = new User(displayName.substring(0, Math.min(displayName.length(), 120)), normalized, null, null);
        user.setGoogleSubject(subject);
        return users.saveAndFlush(user);
    }
    @Transactional
    public String createCode(User user, String challenge) {
        if (challenge == null || !challenge.matches("[A-Za-z0-9_-]{43}")) throw denied();
        byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
        String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        codes.deleteByExpiresAtBefore(Instant.now());
        codes.save(new OAuthCode(hash(code), user.getId(), challenge, Instant.now().plusSeconds(60)));
        return code;
    }
    @Transactional
    public LoginResult exchange(String code, String verifier) {
        OAuthCode stored = codes.lockByHash(hash(code)).orElseThrow(OAuthService::denied);
        if (!stored.getExpiresAt().isAfter(Instant.now()) || !MessageDigest.isEqual(
            stored.getChallenge().getBytes(StandardCharsets.US_ASCII), challenge(verifier).getBytes(StandardCharsets.US_ASCII))) throw denied();
        User user = users.findById(stored.getUserId()).filter(User::isActive).orElseThrow(OAuthService::denied);
        codes.delete(stored); codes.flush();
        return jwt.issue(user);
    }
}
