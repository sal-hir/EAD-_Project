package com.swiftdrop.merchant.service;

import com.swiftdrop.merchant.client.IdentityGateway.Caller;
import com.swiftdrop.merchant.client.MerchantIdentityGateway;
import com.swiftdrop.merchant.dto.MerchantDtos.Status;
import com.swiftdrop.merchant.dto.OAuthDtos.*;
import com.swiftdrop.merchant.entity.Application;
import com.swiftdrop.merchant.exception.*;
import com.swiftdrop.merchant.repository.ApplicationRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class OAuthClientService {
    public static final String AUDIENCE = "swiftdrop-merchant-api";
    public static final Set<String> SUPPORTED_SCOPES = Set.of("merchant:read", "orders:write");
    private final ApplicationRepository applications;
    private final JdbcTemplate db;
    private final MerchantIdentityGateway identities;
    private final TransactionTemplate tx;
    private final long tokenLifetime;
    private final SecureRandom random = new SecureRandom();
    private record Client(Summary summary, String secretHash, long version, UUID userId) {
        @Override public String toString() { return "OAuthClientRow[redacted]"; }
    }
    public OAuthClientService(ApplicationRepository applications, JdbcTemplate db, MerchantIdentityGateway identities,
            PlatformTransactionManager transactions, @Value("${app.oauth.token-ttl-seconds:900}") long lifetime) {
        if (lifetime < 60 || lifetime > 3600) throw new IllegalArgumentException("OAuth token lifetime must be 60–3600 seconds");
        this.applications=applications; this.db=db; this.identities=identities;
        this.tx=new TransactionTemplate(transactions); this.tokenLifetime=lifetime;
    }
    private static ApiFailure missing() { return new ApiFailure(404, "OAuth client unavailable"); }
    private static ApiFailure invalidToken() { return new ApiFailure(401, "Invalid, expired or revoked access token"); }
    private static OAuthFailure invalidClient() { return new OAuthFailure(401, "invalid_client"); }
    private static void merchant(Caller caller) {
        if (caller==null || !"MERCHANT".equals(caller.role())) throw new ApiFailure(403, "Merchant identity required");
    }
    private static List<String> scopes(String value) { return List.of(value.split(" ")); }
    private static String canonical(Collection<String> values) { return String.join(" ", new TreeSet<>(values)); }
    private String secret(String prefix) {
        byte[] bytes=new byte[32]; random.nextBytes(bytes);
        return prefix+Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    private static String hash(String raw) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException("SHA-256 unavailable", impossible); }
    }
    private static Instant instant(ResultSet row, String column) throws SQLException {
        Timestamp value=row.getTimestamp(column); return value==null?null:value.toInstant();
    }
    private Summary summary(ResultSet row, int index) throws SQLException {
        return new Summary(row.getObject("id",UUID.class), row.getObject("merchant_id",UUID.class),
            row.getString("client_identifier"), row.getString("label"), scopes(row.getString("scopes")),
            row.getString("status"), instant(row,"created_at"), instant(row,"rotated_at"), instant(row,"revoked_at"));
    }
    private ClientList list(Application application) {
        var clients=db.query("select * from merchant.oauth_clients where merchant_id=? " +
            "order by case when status='ACTIVE' then 0 else 1 end,created_at desc,id limit 100", this::summary, application.getId());
        return new ClientList(application.getId(), application.getStatus()==Status.APPROVED, clients);
    }
    @Transactional(readOnly=true) public ClientList own(Caller caller) {
        merchant(caller); return list(applications.findByUserId(caller.id()).orElseThrow(OAuthClientService::missing));
    }
    @Transactional(readOnly=true) public ClientList adminList(Caller caller, UUID merchantId) {
        ApplicationService.admin(caller); return list(applications.findById(merchantId).orElseThrow(OAuthClientService::missing));
    }
    @Transactional public Created create(Caller caller, String label, List<String> requestedScopes) {
        merchant(caller);
        if (requestedScopes==null || requestedScopes.isEmpty() || !SUPPORTED_SCOPES.containsAll(requestedScopes))
            throw new ApiFailure(400, "Unsupported OAuth scope");
        var application=applications.lockByOwner(caller.id()).orElseThrow(OAuthClientService::missing);
        requireApproved(application);
        Integer active=db.queryForObject("select count(*) from merchant.oauth_clients where merchant_id=? and status='ACTIVE'",Integer.class,application.getId());
        if (active!=null && active>=5) throw new ApiFailure(409,"Revoke an active OAuth client before creating another (maximum 5)");
        UUID id=UUID.randomUUID(); String clientId="sd_client_"+UUID.randomUUID().toString().replace("-","");
        String raw=secret("sd_cs_"); Instant now=Instant.now(); String granted=canonical(requestedScopes);
        db.update("insert into merchant.oauth_clients(id,merchant_id,client_identifier,label,secret_hash,scopes,status,credential_version,created_by,created_at) " +
            "values(?,?,?,?,?,?,'ACTIVE',0,?,?)",id,application.getId(),clientId,label.strip(),hash(raw),granted,caller.id(),Timestamp.from(now));
        audit(id,caller.id(),"CREATED",now);
        return new Created(new Summary(id,application.getId(),clientId,label.strip(),scopes(granted),"ACTIVE",now,null,null),raw);
    }
    private void requireApproved(Application application) {
        if (application.getStatus()!=Status.APPROVED) throw new ApiFailure(403,"Merchant business approval required");
    }
    private Summary findOwned(UUID merchant, UUID id) {
        var rows=db.query("select * from merchant.oauth_clients where id=? and merchant_id=?",this::summary,id,merchant);
        if (rows.isEmpty()) throw missing(); return rows.getFirst();
    }
    @Transactional public Created rotate(Caller caller, UUID id) {
        merchant(caller); var application=applications.lockByOwner(caller.id()).orElseThrow(OAuthClientService::missing);
        requireApproved(application); Summary client=findOwned(application.getId(),id);
        if (!"ACTIVE".equals(client.status())) throw new ApiFailure(409,"Revoked OAuth clients cannot be rotated");
        String raw=secret("sd_cs_"); Instant now=Instant.now();
        db.update("update merchant.oauth_clients set secret_hash=?,credential_version=credential_version+1,rotated_at=? where id=?",
            hash(raw),Timestamp.from(now),id);
        db.update("delete from merchant.oauth_access_tokens where client_id=?",id);
        audit(id,caller.id(),"SECRET_ROTATED",now);
        return new Created(new Summary(id,client.merchantId(),client.clientId(),client.label(),client.scopes(),"ACTIVE",client.createdAt(),now,null),raw);
    }
    @Transactional public Summary revokeOwn(Caller caller, UUID id) {
        merchant(caller); var application=applications.lockByOwner(caller.id()).orElseThrow(OAuthClientService::missing);
        return revoke(application.getId(),id,caller.id());
    }
    @Transactional public Summary revokeAdmin(Caller caller, UUID merchantId, UUID id) {
        ApplicationService.admin(caller); applications.lockById(merchantId).orElseThrow(OAuthClientService::missing);
        return revoke(merchantId,id,caller.id());
    }
    private Summary revoke(UUID merchantId, UUID id, UUID actor) {
        Summary client=findOwned(merchantId,id); if ("REVOKED".equals(client.status())) return client;
        Instant now=Instant.now();
        db.update("update merchant.oauth_clients set status='REVOKED',revoked_by=?,revoked_at=?,credential_version=credential_version+1 where id=?",actor,Timestamp.from(now),id);
        db.update("delete from merchant.oauth_access_tokens where client_id=?",id); audit(id,actor,"REVOKED",now);
        return new Summary(id,merchantId,client.clientId(),client.label(),client.scopes(),"REVOKED",client.createdAt(),client.rotatedAt(),now);
    }
    private void audit(UUID id, UUID actor, String action, Instant now) {
        db.update("insert into merchant.oauth_client_audit(id,client_id,actor_id,action,created_at) values(?,?,?,?,?)",UUID.randomUUID(),id,actor,action,Timestamp.from(now));
    }
    private Client findClient(String identifier) {
        var rows=db.query("select c.*,a.user_id from merchant.oauth_clients c join merchant.applications a on a.id=c.merchant_id where c.client_identifier=?",
            (r,n)->new Client(summary(r,n),r.getString("secret_hash"),r.getLong("credential_version"),r.getObject("user_id",UUID.class)),identifier);
        if (rows.isEmpty()) throw invalidClient(); return rows.getFirst();
    }
    public Token issue(String clientId, String rawSecret, String requestedScope) {
        if (clientId==null || !clientId.matches("sd_client_[a-f0-9]{32}") || rawSecret==null || !rawSecret.matches("sd_cs_[A-Za-z0-9_-]{43}")) throw invalidClient();
        Client initial=findClient(clientId);
        if (!"ACTIVE".equals(initial.summary().status()) || !MessageDigest.isEqual(hash(rawSecret).getBytes(StandardCharsets.US_ASCII),initial.secretHash().getBytes(StandardCharsets.US_ASCII))) throw invalidClient();
        String granted=canonical(initial.summary().scopes());
        if (requestedScope!=null) {
            if (requestedScope.isBlank() || requestedScope.length()>200) throw new OAuthFailure(400,"invalid_scope");
            var wanted=List.of(requestedScope.split(" ",-1));
            if (!initial.summary().scopes().containsAll(wanted)) throw new OAuthFailure(400,"invalid_scope");
            granted=canonical(wanted);
        }
        try { identities.requireActiveMerchant(initial.userId()); }
        catch (ApiFailure failure) { throw new OAuthFailure(failure.status()==401?401:503,failure.status()==401?"invalid_client":"temporarily_unavailable"); }
        String tokenScopes=granted;
        return tx.execute(status->{
            var application=applications.lockById(initial.summary().merchantId()).orElseThrow(OAuthClientService::invalidClient);
            if (application.getStatus()!=Status.APPROVED) throw invalidClient();
            Client current=findClient(clientId);
            if (!"ACTIVE".equals(current.summary().status()) || current.version()!=initial.version() || !current.secretHash().equals(initial.secretHash())) throw invalidClient();
            Instant now=Instant.now(); String raw=secret("sd_at_");
            db.update("delete from merchant.oauth_access_tokens where client_id=? and expires_at<=?",current.summary().id(),Timestamp.from(now));
            Integer count=db.queryForObject("select count(*) from merchant.oauth_access_tokens where client_id=?",Integer.class,current.summary().id());
            if (count!=null && count>=100) throw new OAuthFailure(503,"temporarily_unavailable");
            db.update("insert into merchant.oauth_access_tokens(token_hash,client_id,credential_version,scopes,audience,created_at,expires_at) values(?,?,?,?,?,?,?)",
                hash(raw),current.summary().id(),current.version(),tokenScopes,AUDIENCE,Timestamp.from(now),Timestamp.from(now.plusSeconds(tokenLifetime)));
            return new Token(raw,"Bearer",tokenLifetime,tokenScopes);
        });
    }
    private List<Identity> lookup(String digest) {
        return db.query("select c.merchant_id,a.user_id,c.client_identifier,t.scopes,t.expires_at,t.audience from merchant.oauth_access_tokens t " +
            "join merchant.oauth_clients c on c.id=t.client_id join merchant.applications a on a.id=c.merchant_id " +
            "where t.token_hash=? and t.expires_at>? and t.audience=? and c.status='ACTIVE' and a.status='APPROVED' and t.credential_version=c.credential_version",
            (r,n)->new Identity(r.getObject("merchant_id",UUID.class),r.getObject("user_id",UUID.class),r.getString("client_identifier"),
                scopes(r.getString("scopes")),instant(r,"expires_at"),r.getString("audience")),digest,Timestamp.from(Instant.now()),AUDIENCE);
    }
    public Identity validate(String raw) {
        if (raw==null || !raw.matches("sd_at_[A-Za-z0-9_-]{43}")) throw invalidToken();
        String digest=hash(raw); var rows=lookup(digest); if (rows.isEmpty()) throw invalidToken();
        Identity identity=rows.getFirst(); identities.requireActiveMerchant(identity.userId());
        if (!lookup(digest).contains(identity)) throw invalidToken(); return identity;
    }
    @Scheduled(initialDelay=3600000,fixedDelay=3600000)
    public void removeExpiredTokens() { db.update("delete from merchant.oauth_access_tokens where expires_at<=?",Timestamp.from(Instant.now())); }
}
