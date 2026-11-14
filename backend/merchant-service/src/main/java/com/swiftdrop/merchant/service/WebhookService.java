package com.swiftdrop.merchant.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swiftdrop.merchant.client.*;
import com.swiftdrop.merchant.dto.WebhookDtos.*;
import com.swiftdrop.merchant.exception.ApiFailure;
import com.swiftdrop.merchant.repository.ApplicationRepository;
import java.net.URI;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class WebhookService {
    private final JdbcTemplate db;private final WebhookSecrets secrets;private final ObjectMapper json;
    private final ApplicationRepository applications;private final MerchantIdentityGateway identities;
    private final WebhookTransport transport;private final TransactionTemplate tx;private final boolean workerEnabled;
    public WebhookService(JdbcTemplate db,WebhookSecrets secrets,ObjectMapper json,ApplicationRepository applications,
            MerchantIdentityGateway identities,WebhookTransport transport,org.springframework.transaction.PlatformTransactionManager manager,
            @Value("${app.webhooks.worker-enabled:true}") boolean workerEnabled) {
        this.db=db;this.secrets=secrets;this.json=json;this.applications=applications;this.identities=identities;
        this.transport=transport;this.tx=new TransactionTemplate(manager);this.workerEnabled=workerEnabled;
    }
    public Settings settings(UUID merchant) {
        var result=db.query("select * from merchant.webhook_settings where merchant_id=?",(r,n)->new Settings(r.getString("url"),r.getBoolean("enabled"),true,r.getTimestamp("updated_at").toInstant()),merchant);
        return result.isEmpty()?new Settings("",false,false,null):result.getFirst();
    }
    public Saved save(UUID merchant,Update request) {
        PublicWebhookTransport.target(request.url());
        return tx.execute(status->{
            applications.lockById(merchant).orElseThrow(()->new ApiFailure(403,"Merchant unavailable"));
            Settings old=settings(merchant);String raw=old.configured()?null:secrets.generate();Instant now=Instant.now();
            if(old.configured()) db.update("update merchant.webhook_settings set url=?,enabled=?,updated_at=? where merchant_id=?",request.url(),request.enabled(),Timestamp.from(now),merchant);
            else db.update("insert into merchant.webhook_settings(merchant_id,url,enabled,secret_cipher,updated_at) values(?,?,?,?,?)",merchant,request.url(),request.enabled(),secrets.encrypt(merchant,raw),Timestamp.from(now));
            if(!request.enabled() || !old.url().equals(request.url())) cancel(merchant,now);
            return new Saved(settings(merchant),raw);
        });
    }
    public Saved rotate(UUID merchant) {
        return tx.execute(status->{
            applications.lockById(merchant).orElseThrow(()->new ApiFailure(403,"Merchant unavailable"));
            if(!settings(merchant).configured())throw new ApiFailure(409,"Configure a webhook first");
            String raw=secrets.generate();Instant now=Instant.now();
            db.update("update merchant.webhook_settings set secret_cipher=?,updated_at=? where merchant_id=?",secrets.encrypt(merchant,raw),Timestamp.from(now),merchant);
            cancel(merchant,now);return new Saved(settings(merchant),raw);
        });
    }
    private void cancel(UUID merchant,Instant now) {
        db.update("update merchant.webhook_deliveries set state='CANCELLED',updated_at=? where merchant_id=? and state in ('PENDING','RETRY','SENDING')",Timestamp.from(now),merchant);
    }
    public UUID test(UUID merchant) {
        return tx.execute(status->{
            applications.lockById(merchant).orElseThrow(()->new ApiFailure(403,"Merchant unavailable"));
            var config=settings(merchant);if(!config.configured()||!config.enabled())throw new ApiFailure(409,"Enable a webhook before testing");
            Integer count=db.queryForObject("select count(*) from merchant.webhook_deliveries where merchant_id=? and event_type='webhook.test' and created_at>?",Integer.class,merchant,Timestamp.from(Instant.now().minusSeconds(3600)));
            if(count!=null&&count>=10)throw new ApiFailure(429,"Maximum ten test events per hour");
            return enqueue(merchant,"test:"+UUID.randomUUID(),"webhook.test",Map.of("message","SwiftDrop webhook test"));
        });
    }
    /** Called within the producer's transaction; event key must be stable for a business event. */
    public UUID enqueue(UUID merchant,String eventKey,String type,Map<String,?> data) {
        var config=db.queryForList("select * from merchant.webhook_settings where merchant_id=? and enabled=true",merchant);
        if(config.isEmpty())return null;
        var existing=db.queryForList("select id from merchant.webhook_deliveries where merchant_id=? and event_key=?",UUID.class,merchant,eventKey);
        if(!existing.isEmpty())return existing.getFirst();
        UUID id=UUID.randomUUID();Instant now=Instant.now();String payload;
        try { payload=json.writeValueAsString(Map.of("id",id,"type",type,"createdAt",now,"data",data)); }
        catch(com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException("Event serialization unavailable",e); }
        var row=config.getFirst();
        db.update("insert into merchant.webhook_deliveries(id,merchant_id,event_key,event_type,payload,target_url,secret_cipher,state,attempts,next_attempt_at,created_at,updated_at) values(?,?,?,?,?,?,?,'PENDING',0,?,?,?)",
            id,merchant,eventKey,type,payload,row.get("url"),row.get("secret_cipher"),Timestamp.from(now),Timestamp.from(now),Timestamp.from(now));
        return id;
    }
    private Delivery delivery(ResultSet r,int n)throws SQLException {
        return new Delivery(r.getObject("id",UUID.class),r.getString("event_type"),r.getString("state"),r.getInt("attempts"),
            Set.of("PENDING","RETRY","SENDING").contains(r.getString("state"))?r.getTimestamp("next_attempt_at").toInstant():null,
            r.getTimestamp("created_at").toInstant(),r.getTimestamp("updated_at").toInstant());
    }
    public Page logs(UUID merchant,int page,int size) {
        if(page<0||page>1000000||size<1||size>100)throw new ApiFailure(400,"Invalid pagination");
        return new Page(db.query("select * from merchant.webhook_deliveries where merchant_id=? order by created_at desc,id desc limit ? offset ?",this::delivery,merchant,size,(long)page*size),page,size,
            Objects.requireNonNull(db.queryForObject("select count(*) from merchant.webhook_deliveries where merchant_id=?",Long.class,merchant)));
    }
    public Detail detail(UUID merchant,UUID id) {
        var rows=db.query("select * from merchant.webhook_deliveries where merchant_id=? and id=?",this::delivery,merchant,id);
        if(rows.isEmpty())throw new ApiFailure(404,"Webhook delivery not found");
        var attempts=db.query("select * from merchant.webhook_attempts where delivery_id=? order by attempt_number",(r,n)->new Attempt(r.getInt("attempt_number"),(Integer)r.getObject("response_status"),r.getString("outcome"),r.getTimestamp("created_at").toInstant()),id);
        return new Detail(rows.getFirst(),attempts);
    }
    public static long retrySeconds(int attempt) { return Math.min(3600,30L*(1L<<Math.min(attempt-1,7))); }
    @Scheduled(initialDelay=10000,fixedDelayString="${app.webhooks.poll-ms:5000}")
    public void poll() {
        if(!workerEnabled)return;
        try { dispatchDue(Instant.now()); }
        catch(Exception ignored) { org.slf4j.LoggerFactory.getLogger(getClass()).warn("Webhook polling unavailable; persisted deliveries retained"); }
    }
    public void dispatchDue(Instant now) {
        // Expired leases are reclaimed; exhaustion remains terminal even after a process crash.
        db.update("update merchant.webhook_deliveries set state='FAILED',updated_at=? where attempts>=6 and state='SENDING' and next_attempt_at<=?",Timestamp.from(now),Timestamp.from(now));
        var ids=db.queryForList("select id from merchant.webhook_deliveries where state in ('PENDING','RETRY','SENDING') and attempts<6 and next_attempt_at<=? order by next_attempt_at limit 20",UUID.class,Timestamp.from(now));
        for(UUID id:ids) dispatch(id,now);
    }
    private void dispatch(UUID id,Instant dueTime) {
        // A batch can take time; never base later leases/signatures on an old polling timestamp.
        Instant current=Instant.now();final Instant now=current.isAfter(dueTime)?current:dueTime;
        // Atomic compare-and-set claim works across replicas. Lease exceeds bounded transport timeout.
        if(db.update("update merchant.webhook_deliveries set state='SENDING',attempts=attempts+1,next_attempt_at=?,updated_at=? where id=? and state in ('PENDING','RETRY','SENDING') and attempts<6 and next_attempt_at<=?",
            Timestamp.from(now.plusSeconds(120)),Timestamp.from(now),id,Timestamp.from(now))!=1)return;
        var rows=db.queryForList("select d.*,a.user_id,a.status as business_status,s.enabled from merchant.webhook_deliveries d join merchant.applications a on a.id=d.merchant_id join merchant.webhook_settings s on s.merchant_id=d.merchant_id where d.id=?",id);
        if(rows.isEmpty())return;
        var row=rows.getFirst();UUID merchant=(UUID)row.get("merchant_id");int attempt=((Number)row.get("attempts")).intValue();
        Integer code=null;String outcome="NETWORK_ERROR";String state;
        try {
            if(!Boolean.TRUE.equals(row.get("enabled"))||!"APPROVED".equals(row.get("business_status")))throw new ApiFailure(401,"Merchant ineligible");
            identities.requireActiveMerchant((UUID)row.get("user_id"));
            // Respect a configuration cancellation that occurred before the send.
            if(!"SENDING".equals(db.queryForObject("select state from merchant.webhook_deliveries where id=?",String.class,id)))return;
            String payload=(String)row.get("payload"),timestamp=Long.toString(now.getEpochSecond());
            String signature=WebhookSecrets.sign(secrets.decrypt(merchant,(String)row.get("secret_cipher")),timestamp,payload);
            code=transport.send(URI.create((String)row.get("target_url")),Map.of("X-SwiftDrop-Event-Id",id.toString(),"X-SwiftDrop-Timestamp",timestamp,"X-SwiftDrop-Signature","v1="+signature),payload);
            outcome="HTTP_"+code;
            state=code>=200&&code<300?"DELIVERED":attempt>=6?"FAILED":"RETRY";
        } catch(ApiFailure e) { outcome=e.status()==401?"MERCHANT_INELIGIBLE":"VALIDATION_UNAVAILABLE";state=e.status()==401?"CANCELLED":attempt>=6?"FAILED":"RETRY"; }
        catch(Exception e) { state=attempt>=6?"FAILED":"RETRY"; }
        Integer response=code;String finalState=state,finalOutcome=outcome;
        tx.executeWithoutResult(transaction->{
            db.update("insert into merchant.webhook_attempts(id,delivery_id,attempt_number,response_status,outcome,created_at) values(?,?,?,?,?,?)",UUID.randomUUID(),id,attempt,response,finalOutcome,Timestamp.from(now));
            db.update("update merchant.webhook_deliveries set state=?,next_attempt_at=?,updated_at=? where id=? and state='SENDING' and attempts=?",finalState,Timestamp.from(now.plusSeconds(retrySeconds(attempt))),Timestamp.from(now),id,attempt);
        });
    }
}
