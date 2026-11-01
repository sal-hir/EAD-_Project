package com.swiftdrop.auth.service;

import java.sql.Timestamp;
import java.time.Instant;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class RecoveryRateLimiter {
    private final JdbcTemplate db;
    public RecoveryRateLimiter(JdbcTemplate db){this.db=db;}
    private boolean hit(String key,int limit,Instant now){
        String hash=BrowserSessionService.hash(key);
        var counts=db.query("select hits from auth.recovery_rate_limits where bucket_hash=?",(r,n)->r.getInt(1),hash);
        if(counts.isEmpty()){db.update("insert into auth.recovery_rate_limits(bucket_hash,hits,expires_at) values(?,1,?)",hash,Timestamp.from(now.plusSeconds(900)));return true;}
        if(counts.getFirst()>=limit)return false;
        db.update("update auth.recovery_rate_limits set hits=hits+1 where bucket_hash=?",hash);return true;
    }
    @Transactional public boolean allow(String email,String address){
        Instant now=Instant.now();db.queryForObject("select id from auth.recovery_rate_guard where id=1 for update",Integer.class);
        db.update("delete from auth.recovery_rate_limits where expires_at<=?",Timestamp.from(now));
        if(!hit("ip:"+address,20,now))return false;
        return hit("email:"+email,3,now);
    }
}
