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
import org.springframework.jdbc.core.JdbcTemplate;

@Service
public class OAuthService {
    private final UserRepository users;
    private final OAuthCodeRepository codes;
    private final JwtService jwt;
    private final IdentityService identities;
    private final JdbcTemplate db;
    public OAuthService(UserRepository users, OAuthCodeRepository codes, JwtService jwt, IdentityService identities, JdbcTemplate db) {
        this.users=users; this.codes=codes; this.jwt=jwt; this.identities=identities; this.db=db;
    }
    public static byte[] digest(String value) {
        try { return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.US_ASCII)); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    public static String challenge(String verifier) { return Base64.getUrlEncoder().withoutPadding().encodeToString(digest(verifier)); }
    private static String hash(String code) { return HexFormat.of().formatHex(digest(code)); }
    private static ApiException denied() { return new ApiException(HttpStatus.UNAUTHORIZED, "Google authentication unavailable for this identity"); }
    public static class ActivationRequired extends ApiException {
        public ActivationRequired(){super(HttpStatus.UNAUTHORIZED,"Complete existing account activation before using Google");}
    }
    private ApiException conflict(User target) {
        identities.securityAudit(target.getId(),"GOOGLE_LINK_CONFLICT","Verified Google identity conflicts with an existing association");
        return denied();
    }
    @Transactional
    public User googleUser(String subject, String email, Boolean verified, String name) {
        if (!Boolean.TRUE.equals(verified) || subject == null || subject.isBlank() || subject.length()>255 || email == null || email.isBlank()) throw denied();
        String normalized=AuthService.normalize(email);
        if(normalized.length()>254)throw denied();
        // Shared guard locks before identities, matching administrative mutations.
        // This also serializes concurrent first logins for absent users; unique
        // email/subject constraints remain the final database protection.
        db.queryForObject("select id from auth.identity_admin_guard where id=1 for update",Integer.class);
        Optional<User> existing=users.findByGoogleSubject(subject);
        Optional<User> matched=users.findByEmail(normalized);
        if(existing.isPresent()) {
            User user=users.lockById(existing.get().getId()).orElseThrow(OAuthService::denied);
            if(!user.isActive())throw denied();
            if(matched.isPresent()&&!matched.get().getId().equals(user.getId()))throw conflict(matched.get());
            return user; // Stable provider subject, never move an established association.
        }
        if(matched.isPresent()) {
            User user=users.lockById(matched.get().getId()).orElseThrow(OAuthService::denied);
            if(!user.isActive())throw denied();
            if(user.getGoogleSubject()!=null)throw conflict(user);
            // No separate local email-verification flag exists. Preserve current
            // activation requirements: a provisioned credential-free user must
            // complete its invitation; verified Google proof cannot bypass that.
            if(user.getPasswordHash()==null)throw new ActivationRequired();
            user.setGoogleSubject(subject);
            identities.invalidate(user); // Adding a credential revokes older sessions/codes.
            users.saveAndFlush(user);
            identities.audit(user.getId(),user.getId(),"GOOGLE_AUTO_LINKED","Verified Google email; existing activation requirements satisfied");
            return user;
        }
        String displayName=name==null||name.isBlank()?"SwiftDrop customer":name.strip();
        User user=new User(displayName.substring(0,Math.min(displayName.length(),120)),normalized,null,null);
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
