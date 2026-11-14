package com.swiftdrop.merchant.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.swiftdrop.merchant.dto.OrderDtos.*;
import com.swiftdrop.merchant.dto.MerchantDtos.Status;
import com.swiftdrop.merchant.exception.ApiFailure;
import com.swiftdrop.merchant.repository.ApplicationRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {
    private final JdbcTemplate db;
    private final ApplicationRepository applications;
    private final ObjectMapper json;
    public OrderService(JdbcTemplate db, ApplicationRepository applications, ObjectMapper json) {
        this.db=db; this.applications=applications; this.json=json;
    }
    // Serializes duplicate submissions across replicas using the existing business row.
    @Transactional
    public Created create(UUID merchant, String key, Create request) {
        if (key==null || !key.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}"))
            throw new ApiFailure(400,"A valid Idempotency-Key header is required (1-128 characters)");
        var business=applications.lockById(merchant).orElseThrow(()->new ApiFailure(401,"Merchant unavailable"));
        if (business.getStatus()!=Status.APPROVED) throw new ApiFailure(401,"Approved merchant required");
        String payload=encode(request);
        String digest=hash(payload);
        var matches=db.query("select * from merchant.orders where merchant_id=? and (idempotency_key=? or merchant_order_id=?)",
            (r,n)->new Existing(map(r,n),r.getString("idempotency_key"),r.getString("request_hash")),merchant,key,request.merchantOrderId());
        if (!matches.isEmpty()) {
            Existing existing=matches.getFirst();
            if (matches.size()!=1 || !existing.key().equals(key) || !existing.digest().equals(digest))
                throw new ApiFailure(409,"Order reference or idempotency key already used; retry the original request unchanged");
            return new Created(existing.order(),true);
        }
        UUID id=UUID.randomUUID(); Instant now=Instant.now();
        db.update("insert into merchant.orders(id,merchant_id,merchant_order_id,idempotency_key,request_json,request_hash,status,created_at) values(?,?,?,?,?,?,'PENDING_BOOKING',?)",
            id,merchant,request.merchantOrderId(),key,payload,digest,Timestamp.from(now));
        return new Created(new Order(id,merchant,request.merchantOrderId(),"PENDING_BOOKING",null,null,now,request),false);
    }
    public Order get(UUID merchant, UUID id) {
        var rows=db.query("select * from merchant.orders where merchant_id=? and id=?",this::map,merchant,id);
        if (rows.isEmpty()) throw new ApiFailure(404,"Order not found");
        return rows.getFirst();
    }
    @Transactional(readOnly=true, isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Page list(UUID merchant, int page, int size) {
        if (page<0 || page>1000000 || size<1 || size>100) throw new ApiFailure(400,"page must be 0-1000000 and size 1-100");
        long total=Objects.requireNonNull(db.queryForObject("select count(*) from merchant.orders where merchant_id=?",Long.class,merchant));
        var orders=db.query("select * from merchant.orders where merchant_id=? order by created_at desc,id desc limit ? offset ?",
            this::map,merchant,size,(long)page*size);
        return new Page(orders,page,size,total);
    }
    private record Existing(Order order,String key,String digest) {}
    private Order map(ResultSet r,int row) throws SQLException {
        try {
            return new Order(r.getObject("id",UUID.class),r.getObject("merchant_id",UUID.class),r.getString("merchant_order_id"),
                r.getString("status"),null,null,r.getTimestamp("created_at").toInstant(),json.readValue(r.getString("request_json"),Create.class));
        } catch (JsonProcessingException e) { throw new IllegalStateException("Stored order cannot be read",e); }
    }
    private String encode(Create request) {
        // Normalize decimal scale so JSON numeric spelling does not break an otherwise identical retry.
        var p=request.parcel();
        var canonical=new Create(request.merchantOrderId(),request.pickup(),request.recipient(),
            new Parcel(p.description(),p.weightKg().stripTrailingZeros(),p.lengthCm().stripTrailingZeros(),
                p.widthCm().stripTrailingZeros(),p.heightCm().stripTrailingZeros()),request.serviceType(),request.notes());
        try { return json.writeValueAsString(canonical); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Order cannot be encoded",e); }
    }
    private static String hash(String input) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
