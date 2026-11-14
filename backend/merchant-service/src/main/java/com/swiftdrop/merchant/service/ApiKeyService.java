package com.swiftdrop.merchant.service;

import com.swiftdrop.merchant.client.IdentityGateway.Caller;
import com.swiftdrop.merchant.client.MerchantIdentityGateway;
import com.swiftdrop.merchant.dto.ApiKeyDtos.*;
import com.swiftdrop.merchant.dto.MerchantDtos.Status;
import com.swiftdrop.merchant.entity.Application;
import com.swiftdrop.merchant.exception.ApiFailure;
import com.swiftdrop.merchant.repository.ApplicationRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApiKeyService {
    private final ApplicationRepository applications;
    private final JdbcTemplate db;
    private final MerchantIdentityGateway identities;
    private final SecureRandom random = new SecureRandom();

    public ApiKeyService(ApplicationRepository applications, JdbcTemplate db, MerchantIdentityGateway identities) {
        this.applications = applications; this.db = db; this.identities = identities;
    }
    private static ApiFailure missing() { return new ApiFailure(404, "Credential unavailable"); }
    private static ApiFailure invalid() { return new ApiFailure(401, "Invalid or revoked API key"); }
    private void merchant(Caller caller) {
        if (caller == null || !"MERCHANT".equals(caller.role()))
            throw new ApiFailure(403, "Merchant identity required");
    }
    private Summary summary(ResultSet row, int index) throws SQLException {
        Timestamp revoked = row.getTimestamp("revoked_at");
        return new Summary(row.getObject("id", UUID.class), row.getObject("merchant_id", UUID.class),
            row.getString("label"), row.getString("key_prefix"), row.getString("status"),
            row.getTimestamp("created_at").toInstant(), revoked == null ? null : revoked.toInstant());
    }
    private KeyList list(Application application) {
        var keys = db.query("select id,merchant_id,label,key_prefix,status,created_at,revoked_at from merchant.api_keys " +
            "where merchant_id=? order by case when status='ACTIVE' then 0 else 1 end,created_at desc,id limit 100",
            this::summary, application.getId());
        return new KeyList(application.getId(), application.getStatus() == Status.APPROVED, keys);
    }
    @Transactional(readOnly = true)
    public KeyList own(Caller caller) {
        merchant(caller);
        return list(applications.findByUserId(caller.id()).orElseThrow(ApiKeyService::missing));
    }
    @Transactional(readOnly = true)
    public KeyList adminList(Caller caller, UUID merchantId) {
        ApplicationService.admin(caller);
        return list(applications.findById(merchantId).orElseThrow(ApiKeyService::missing));
    }
    @Transactional
    public Created create(Caller caller, String label) {
        merchant(caller);
        // Serialize issuance and revocation per business, including the active-key limit.
        var application = applications.lockByOwner(caller.id()).orElseThrow(ApiKeyService::missing);
        if (application.getStatus() != Status.APPROVED)
            throw new ApiFailure(403, "Merchant business approval required");
        Integer count = db.queryForObject("select count(*) from merchant.api_keys where merchant_id=? and status='ACTIVE'",
            Integer.class, application.getId());
        if (count != null && count >= 5) throw new ApiFailure(409, "Revoke an active key before creating another (maximum 5)");
        byte[] entropy = new byte[32]; random.nextBytes(entropy);
        String raw = "sd_mk_" + Base64.getUrlEncoder().withoutPadding().encodeToString(entropy);
        UUID id = UUID.randomUUID(); Instant now = Instant.now(); String prefix = raw.substring(0, 14);
        db.update("insert into merchant.api_keys(id,merchant_id,label,key_prefix,key_hash,status,created_by,created_at) " +
            "values(?,?,?,?,?,'ACTIVE',?,?)", id, application.getId(), label.strip(), prefix, hash(raw), caller.id(), Timestamp.from(now));
        audit(id, caller.id(), "CREATED", now);
        return new Created(new Summary(id, application.getId(), label.strip(), prefix, "ACTIVE", now, null), raw);
    }
    @Transactional
    public Summary revokeOwn(Caller caller, UUID keyId) {
        merchant(caller);
        var application = applications.lockByOwner(caller.id()).orElseThrow(ApiKeyService::missing);
        return revoke(application.getId(), keyId, caller.id());
    }
    @Transactional
    public Summary revokeAdmin(Caller caller, UUID merchantId, UUID keyId) {
        ApplicationService.admin(caller);
        applications.lockById(merchantId).orElseThrow(ApiKeyService::missing);
        return revoke(merchantId, keyId, caller.id());
    }
    private Summary revoke(UUID merchantId, UUID id, UUID actor) {
        var found = db.query("select id,merchant_id,label,key_prefix,status,created_at,revoked_at from merchant.api_keys " +
            "where id=? and merchant_id=?", this::summary, id, merchantId);
        if (found.isEmpty()) throw missing();
        if ("REVOKED".equals(found.getFirst().status())) return found.getFirst();
        Instant now = Instant.now();
        db.update("update merchant.api_keys set status='REVOKED',revoked_at=?,revoked_by=? where id=? and merchant_id=?",
            Timestamp.from(now), actor, id, merchantId);
        audit(id, actor, "REVOKED", now);
        Summary key = found.getFirst();
        return new Summary(id, merchantId, key.label(), key.prefix(), "REVOKED", key.createdAt(), now);
    }
    private void audit(UUID key, UUID actor, String action, Instant time) {
        db.update("insert into merchant.api_key_audit(id,key_id,actor_id,action,created_at) values(?,?,?,?,?)",
            UUID.randomUUID(), key, actor, action, Timestamp.from(time));
    }
    private static String hash(String raw) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException("SHA-256 unavailable", impossible); }
    }
    private List<Identity> lookup(String digest) {
        return db.query("select k.id,k.merchant_id,a.user_id from merchant.api_keys k " +
            "join merchant.applications a on a.id=k.merchant_id " +
            "where k.key_hash=? and k.status='ACTIVE' and a.status='APPROVED'",
            (r,n) -> new Identity(r.getObject("merchant_id", UUID.class), r.getObject("user_id", UUID.class),
                r.getObject("id", UUID.class)), digest);
    }
    public Identity validate(String raw) {
        if (raw == null || !raw.matches("sd_mk_[A-Za-z0-9_-]{43}")) throw invalid();
        String digest = hash(raw);
        var matches = lookup(digest);
        if (matches.isEmpty()) throw invalid();
        Identity identity = matches.getFirst();
        // Each machine request checks current Auth state; outages fail closed.
        identities.requireActiveMerchant(identity.userId());
        // Recheck after remote I/O so revocation during the Auth lookup takes effect.
        if (!lookup(digest).contains(identity)) throw invalid();
        return identity;
    }
}
