package com.swiftdrop.auth.service;

import com.swiftdrop.auth.dto.AuthDtos.Profile;
import com.swiftdrop.auth.dto.IdentityDtos.*;
import com.swiftdrop.auth.entity.*;
import com.swiftdrop.auth.exception.ApiException;
import com.swiftdrop.auth.repository.UserRepository;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.validation.Validator;

@Service
public class IdentityService {
    private final UserRepository users;
    private final JdbcTemplate db;
    private final PasswordEncoder passwords;
    private final Validator validator;
    private final String frontend;
    public IdentityService(UserRepository users, JdbcTemplate db, PasswordEncoder passwords, Validator validator,
            @Value("${app.frontend-url}") String frontend) {
        this.users=users;this.db=db;this.passwords=passwords;this.validator=validator;this.frontend=frontend;
    }
    static ApiException forbidden(String message) { return new ApiException(HttpStatus.FORBIDDEN,message); }
    public static ApiException invalidAction() { return new ApiException(HttpStatus.UNAUTHORIZED,"Activation or linking request expired, unavailable or already used"); }
    private void guard() { db.queryForObject("select id from auth.identity_admin_guard where id=1 for update",Integer.class); }
    private User admin(UUID actor) {
        return users.findById(actor).filter(u->u.isActive()&&u.getRole()==Role.ADMIN).orElseThrow(()->forbidden("Administrator access required"));
    }
    private User target(UUID actor,UUID id) {
        if(actor.equals(id))throw forbidden("You cannot modify your own identity");
        User u=users.lockById(id).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"User unavailable"));
        // Admin creation/removal is deliberately excluded from ordinary management.
        if(u.getRole()==Role.ADMIN)throw forbidden("Administrator identities cannot be changed here; the final administrator is protected");
        return u;
    }
    private void permitted(Role role) {
        if(!Set.of(Role.MERCHANT,Role.COURIER,Role.DISPATCHER).contains(role))throw forbidden("Only MERCHANT, COURIER and DISPATCHER may be provisioned or assigned here");
    }
    public void audit(UUID actor,UUID target,String action,String detail) {
        db.update("insert into auth.identity_audit(id,actor_id,target_id,action,detail,created_at) values(?,?,?,?,?,?)",
            UUID.randomUUID(),actor,target,action,detail,Timestamp.from(Instant.now()));
    }
    public void invalidate(User user) {
        user.invalidateCredentials();
        db.update("delete from auth.password_reset_tokens where user_id=?",user.getId());
        db.update("update auth.refresh_sessions set revoked_at=? where user_id=? and revoked_at is null",Timestamp.from(Instant.now()),user.getId());
        db.update("delete from auth.oauth_codes where user_id=?",user.getId());
        db.update("delete from auth.identity_actions where user_id=?",user.getId());
    }
    public record Action(UUID userId, UUID sessionId, String challenge) {}
    public String issueAction(UUID user, String purpose, UUID session, String challenge, Instant expiry) {
        db.update("delete from auth.identity_actions where expires_at < ? or (user_id=? and purpose=?)",Timestamp.from(Instant.now()),user,purpose);
        byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);
        String raw=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        db.update("insert into auth.identity_actions(token_hash,user_id,purpose,session_id,challenge,expires_at) values(?,?,?,?,?,?)",
            BrowserSessionService.hash(raw),user,purpose,session,challenge,Timestamp.from(expiry));
        return raw;
    }
    public Action consumeAction(String raw,String purpose) {
        if(raw==null||!raw.matches("[A-Za-z0-9_-]{43}"))throw invalidAction();
        String hash=BrowserSessionService.hash(raw);
        // Lock user before action/session rows, matching administrative mutations.
        var owners=db.query("select user_id from auth.identity_actions where token_hash=? and purpose=? and expires_at>?",
            (r,n)->r.getObject(1,UUID.class),hash,purpose,Timestamp.from(Instant.now()));
        if(owners.isEmpty())throw invalidAction();
        users.lockById(owners.getFirst()).orElseThrow(IdentityService::invalidAction);
        var rows=db.query("select user_id,session_id,challenge from auth.identity_actions where token_hash=? and purpose=? and expires_at>? for update",
            (r,n)->new Action(r.getObject(1,UUID.class),r.getObject(2,UUID.class),r.getString(3)),hash,purpose,Timestamp.from(Instant.now()));
        if(rows.isEmpty())throw invalidAction();
        db.update("delete from auth.identity_actions where token_hash=?",hash);return rows.getFirst();
    }
    @Transactional public Profile bootstrap(String name,String email,String password) {
        var request=new ProvisionRequest(name,email,null,Role.DISPATCHER,true);
        if(!validator.validate(request).isEmpty()||!validator.validate(new PasswordRequest(password)).isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST,"Invalid administrator name, email or password");
        guard();
        if(Boolean.TRUE.equals(db.queryForObject("select bootstrapped from auth.identity_admin_guard where id=1",Boolean.class))||users.existsByRole(Role.ADMIN))
            throw forbidden("Administrator bootstrap has already been completed or an administrator exists");
        if(users.existsByEmail(AuthService.normalize(email)))throw new ApiException(HttpStatus.CONFLICT,"Account already exists; bootstrap cannot promote an existing account");
        User user=new User(name.strip(),AuthService.normalize(email),passwords.encode(password),null);user.setRole(Role.ADMIN);
        users.saveAndFlush(user);db.update("update auth.identity_admin_guard set bootstrapped=true where id=1");
        audit(null,user.getId(),"ADMIN_BOOTSTRAP","Local console setup");return Profile.from(user);
    }
    private Activation activation(User user,UUID actor) {
        if(user.getPasswordHash()!=null||user.getGoogleSubject()!=null)throw forbidden("Account already has credentials");
        Instant expiry=Instant.now().plusSeconds(1800);
        String raw=issueAction(user.getId(),"ACTIVATION",null,null,expiry);
        audit(actor,user.getId(),"ACTIVATION_ISSUED","Single use; expires in 30 minutes");
        return new Activation(Profile.from(user),frontend+"/activate#code="+raw,expiry);
    }
    @Transactional public Activation provision(UUID actor,ProvisionRequest request) {
        guard();admin(actor);permitted(request.role());
        if(users.existsByEmail(AuthService.normalize(request.email())))throw new ApiException(HttpStatus.CONFLICT,"Account already exists");
        User user=new User(request.name().strip(),AuthService.normalize(request.email()),null,request.phone());
        user.setRole(request.role());user.setActive(request.active());users.saveAndFlush(user);
        audit(actor,user.getId(),"USER_PROVISIONED",request.role().name());return activation(user,actor);
    }
    @Transactional public Activation reissue(UUID actor,UUID id) { guard();admin(actor);return activation(target(actor,id),actor); }
    @Transactional public Profile status(UUID actor,UUID id,boolean active) {
        guard();admin(actor);User user=target(actor,id);
        if(user.isActive()!=active){user.setActive(active);invalidate(user);audit(actor,id,"STATUS_CHANGED",Boolean.toString(active));}
        return Profile.from(users.saveAndFlush(user));
    }
    @Transactional public Profile role(UUID actor,UUID id,Role role) {
        guard();admin(actor);permitted(role);User user=target(actor,id);
        if(user.getRole()!=role){String before=user.getRole().name();user.setRole(role);invalidate(user);audit(actor,id,"ROLE_CHANGED",before+" -> "+role.name());}
        return Profile.from(users.saveAndFlush(user));
    }
    @Transactional public void activate(ActivationRequest request) {
        Action action=consumeAction(request.code(),"ACTIVATION");
        User user=users.lockById(action.userId()).filter(User::isActive).orElseThrow(IdentityService::invalidAction);
        if(user.getPasswordHash()!=null||user.getGoogleSubject()!=null)throw invalidAction();
        user.setPasswordHash(passwords.encode(request.password()));invalidate(user);users.saveAndFlush(user);
        audit(user.getId(),user.getId(),"ACCOUNT_ACTIVATED","Initial credential set");
    }
    @Transactional(readOnly=true) public UserPage list(UUID actor,String search,int page) {
        admin(actor);String term=search==null?"":search.strip();
        if(term.length()>120||page<0)throw new ApiException(HttpStatus.BAD_REQUEST,"Invalid search or page");
        var result=users.findByEmailContainingIgnoreCaseOrNameContainingIgnoreCase(term,term,PageRequest.of(page,20,Sort.by("createdAt").descending().and(Sort.by("id"))));
        return new UserPage(result.map(Profile::from).getContent(),page,result.getTotalElements(),result.getTotalPages());
    }
    @Transactional(readOnly=true) public Profile get(UUID actor,UUID id) { admin(actor);return Profile.from(users.findById(id).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"User unavailable"))); }
    @Transactional(readOnly=true) public List<Audit> audits(UUID actor,UUID id) {
        admin(actor);return db.query("select id,actor_id,target_id,action,detail,created_at from auth.identity_audit where target_id=? order by created_at desc limit 100",
            (r,n)->new Audit(r.getObject(1,UUID.class),r.getObject(2,UUID.class),r.getObject(3,UUID.class),r.getString(4),r.getString(5),r.getTimestamp(6).toInstant()),id);
    }
}
