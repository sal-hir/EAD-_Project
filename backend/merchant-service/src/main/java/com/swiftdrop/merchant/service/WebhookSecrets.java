package com.swiftdrop.merchant.service;

import com.swiftdrop.merchant.exception.ApiFailure;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;
import javax.crypto.*;
import javax.crypto.spec.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class WebhookSecrets {
    private final String master;
    private final SecureRandom random=new SecureRandom();
    public WebhookSecrets(@Value("${app.webhooks.encryption-key:}") String master) { this.master=master; }
    private byte[] key() {
        try { byte[] key=Base64.getDecoder().decode(master);if(key.length==32)return key; }
        catch(IllegalArgumentException ignored) {}
        throw new ApiFailure(503,"Webhook encryption key is not configured");
    }
    public String generate() { byte[] raw=new byte[32];random.nextBytes(raw);return "whsec_"+Base64.getUrlEncoder().withoutPadding().encodeToString(raw); }
    public String encrypt(UUID merchant,String secret) {
        try {
            byte[] iv=new byte[12]; random.nextBytes(iv);
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key(),"AES"),new GCMParameterSpec(128,iv));
            cipher.updateAAD(merchant.toString().getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(iv)+"."+Base64.getEncoder().encodeToString(cipher.doFinal(secret.getBytes(StandardCharsets.UTF_8)));
        } catch(java.security.GeneralSecurityException e) { throw new ApiFailure(503,"Webhook encryption unavailable"); }
    }
    public String decrypt(UUID merchant,String stored) {
        try {
            String[] parts=stored.split("\\.");
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,new SecretKeySpec(key(),"AES"),new GCMParameterSpec(128,Base64.getDecoder().decode(parts[0])));
            cipher.updateAAD(merchant.toString().getBytes(StandardCharsets.UTF_8));
            return new String(cipher.doFinal(Base64.getDecoder().decode(parts[1])),StandardCharsets.UTF_8);
        } catch(java.security.GeneralSecurityException|IllegalArgumentException|ArrayIndexOutOfBoundsException e) { throw new ApiFailure(503,"Webhook secret unavailable"); }
    }
    public static String sign(String secret,String timestamp,String payload) {
        try {
            Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((timestamp+"."+payload).getBytes(StandardCharsets.UTF_8)));
        } catch(java.security.GeneralSecurityException e) { throw new IllegalStateException(e); }
    }
}
