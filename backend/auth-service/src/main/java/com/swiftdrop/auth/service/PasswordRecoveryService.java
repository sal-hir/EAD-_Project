package com.swiftdrop.auth.service;

import com.swiftdrop.auth.repository.UserRepository;
import com.swiftdrop.auth.exception.ApiException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.concurrent.Executor;
import org.springframework.beans.factory.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class PasswordRecoveryService {
    public static final String MESSAGE="If an eligible account exists, password reset instructions will be sent. If you use Google sign-in, continue with Google.";
    private final RecoveryRateLimiter limiter;
    private final UserRepository users;
    private final IdentityService identities;
    private final PasswordEncoder passwords;
    private final RecoveryMailer mailer;
    private final Executor executor;
    private final TransactionTemplate tx;
    private final JdbcTemplate db;
    private final String frontend;
    private record Delivery(String email,String token){@Override public String toString(){return "Delivery[redacted]";}}
    public PasswordRecoveryService(RecoveryRateLimiter limiter,UserRepository users,IdentityService identities,PasswordEncoder passwords,
        RecoveryMailer mailer,@Qualifier("recoveryExecutor") Executor executor,PlatformTransactionManager manager,JdbcTemplate db,
        @Value("${app.frontend-url}") String frontend){this.limiter=limiter;this.users=users;this.identities=identities;this.passwords=passwords;this.mailer=mailer;this.executor=executor;this.tx=new TransactionTemplate(manager);this.db=db;this.frontend=frontend;}
    public void forgot(String address,String ip){
        String email=AuthService.normalize(address);
        // No eligibility lookup or SMTP operation occurs on the public response path.
        if(!limiter.allow(email,ip))return;
        try{executor.execute(()->{
            try{deliver(email);}catch(RuntimeException unavailable){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Password recovery delivery unavailable");}
        });}catch(org.springframework.core.task.TaskRejectedException unavailable){/* Same generic response; bounded queue prevents resource exhaustion. */}
    }
    public void deliver(String email){
        Delivery delivery=tx.execute(status->{
            var candidate=users.findByEmail(email);if(candidate.isEmpty())return null;
            var user=users.lockById(candidate.get().getId()).orElseThrow();
            if(!user.isActive()||user.getPasswordHash()==null)return null;
            byte[] bytes=new byte[32];new java.security.SecureRandom().nextBytes(bytes);
            String raw=java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            db.update("delete from auth.password_reset_tokens where expires_at<?",Timestamp.from(Instant.now()));
            db.update("insert into auth.password_reset_tokens(token_hash,user_id,expires_at) values(?,?,?)",BrowserSessionService.hash(raw),user.getId(),Timestamp.from(Instant.now().plusSeconds(1200)));
            return new Delivery(user.getEmail(),raw);
        });
        if(delivery==null)return;
        try{mailer.send(delivery.email(),frontend+"/reset-password#token="+delivery.token());}
        catch(RuntimeException unavailable){
            tx.executeWithoutResult(s->db.update("delete from auth.password_reset_tokens where token_hash=?",BrowserSessionService.hash(delivery.token())));
            org.slf4j.LoggerFactory.getLogger(getClass()).warn("Password recovery email could not be delivered; verify SMTP configuration");
        }
    }
    private static ApiException invalid(){return new ApiException(HttpStatus.UNAUTHORIZED,"Password reset link expired, unavailable or already used");}
    public void reset(String token,String password){
        tx.executeWithoutResult(status->{
            String hash=BrowserSessionService.hash(token);
            var owners=db.query("select user_id from auth.password_reset_tokens where token_hash=?",(r,n)->r.getObject(1,java.util.UUID.class),hash);
            if(owners.isEmpty())throw invalid();
            var user=users.lockById(owners.getFirst()).orElseThrow(PasswordRecoveryService::invalid);
            var valid=db.query("select token_hash from auth.password_reset_tokens where token_hash=? and expires_at>? for update",(r,n)->r.getString(1),hash,Timestamp.from(Instant.now()));
            if(valid.isEmpty())throw invalid();
            if(!user.isActive()||user.getPasswordHash()==null)throw new ApiException(HttpStatus.UNAUTHORIZED,"Password reset link expired, unavailable or already used");
            user.setPasswordHash(passwords.encode(password));identities.invalidate(user);users.saveAndFlush(user);
            identities.audit(user.getId(),user.getId(),"PASSWORD_RESET","All sessions and outstanding recovery tokens revoked");
        });
    }
}
