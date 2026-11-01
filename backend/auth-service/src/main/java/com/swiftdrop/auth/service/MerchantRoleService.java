package com.swiftdrop.auth.service;

import com.swiftdrop.auth.dto.AuthDtos.Profile;
import com.swiftdrop.auth.entity.*;
import com.swiftdrop.auth.exception.ApiException;
import com.swiftdrop.auth.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MerchantRoleService {
    private final UserRepository users;private final IdentityService identities;private final JdbcTemplate db;private final String key;
    public MerchantRoleService(UserRepository users,IdentityService identities,JdbcTemplate db,@Value("${app.merchant-service-token:}") String key){this.users=users;this.identities=identities;this.db=db;this.key=key;}
    @Transactional public Profile grant(UUID actor,UUID application,UUID target,String supplied){
        if(key.length()<32)throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"Merchant integration is not configured");
        if(supplied==null||!MessageDigest.isEqual(key.getBytes(StandardCharsets.UTF_8),supplied.getBytes(StandardCharsets.UTF_8)))throw new ApiException(HttpStatus.FORBIDDEN,"Internal service authentication required");
        db.queryForObject("select id from auth.identity_admin_guard where id=1 for update",Integer.class);
        users.findById(actor).filter(u->u.isActive()&&u.getRole()==Role.ADMIN).orElseThrow(()->new ApiException(HttpStatus.FORBIDDEN,"Administrator access required"));
        User user=users.lockById(target).filter(User::isActive).orElseThrow(()->new ApiException(HttpStatus.CONFLICT,"Applicant identity is unavailable"));
        if(!Set.of(Role.CUSTOMER,Role.MERCHANT).contains(user.getRole()))throw new ApiException(HttpStatus.CONFLICT,"Applicant role is not eligible for merchant approval");
        var granted=db.query("select user_id from auth.merchant_role_grants where application_id=?",(r,n)->r.getObject(1,UUID.class),application);
        if(!granted.isEmpty()){
            if(!granted.getFirst().equals(target)||user.getRole()!=Role.MERCHANT)throw new ApiException(HttpStatus.CONFLICT,"Approval identity changed; administrator reconciliation required");
            return Profile.from(user);
        }
        if(user.getRole()==Role.CUSTOMER){user.setRole(Role.MERCHANT);identities.invalidate(user);users.saveAndFlush(user);}
        db.update("insert into auth.merchant_role_grants(application_id,user_id,actor_id,granted_at) values(?,?,?,?)",application,target,actor,Timestamp.from(Instant.now()));
        identities.audit(actor,target,"MERCHANT_APPROVED","Application "+application);return Profile.from(user);
    }
}
