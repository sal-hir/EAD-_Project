package com.swiftdrop.merchant;

import com.fasterxml.jackson.databind.*;
import com.swiftdrop.merchant.client.*;
import com.swiftdrop.merchant.dto.MerchantDtos.Business;
import com.swiftdrop.merchant.entity.Application;
import com.swiftdrop.merchant.repository.ApplicationRepository;
import com.swiftdrop.merchant.service.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.*;
import org.springframework.context.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
@Import({ApiKeyIntegrationTest.Identities.class,WebhookIntegrationTest.TransportConfig.class})
class WebhookIntegrationTest {
    static final String BASE="/api/v1/merchants/operations";
    static class Transport implements WebhookTransport {
        volatile int status=204,calls;volatile String payload;volatile Map<String,String> headers;volatile boolean fail;
        public synchronized int send(URI target,Map<String,String> headers,String payload)throws java.io.IOException {
            calls++;this.payload=payload;this.headers=headers;if(fail)throw new java.io.IOException("private remote diagnostic");return status;
        }
    }
    @TestConfiguration static class TransportConfig { @Bean @Primary Transport transport(){return new Transport();} }
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired JdbcTemplate db;@Autowired ApplicationRepository applications;
    @Autowired ApiKeyIntegrationTest.FakeIdentity identities;@Autowired WebhookService hooks;@Autowired Transport transport;
    @Autowired ApiKeyService keys;
    UUID merchant;
    @BeforeEach void setup() {
        db.update("delete from merchant.approval_audit");applications.deleteAll();identities.inactive=false;identities.outage=false;
        transport.status=204;transport.calls=0;transport.fail=false;
        for(UUID owner:List.of(ApiKeyIntegrationTest.OWNER,ApiKeyIntegrationTest.OTHER,ApiKeyIntegrationTest.PENDING)) {
            var app=new Application(owner,new Business("Shop",null,null,"Retail","Owner","shop@example.lk","+94771234567","Main road","Colombo",null,null));
            if(!owner.equals(ApiKeyIntegrationTest.PENDING))app.approved();applications.saveAndFlush(app);
            if(owner.equals(ApiKeyIntegrationTest.OWNER))merchant=app.getId();
        }
    }
    ResultActions save(String url,boolean enabled)throws Exception {
        return mvc.perform(put(BASE+"/webhook").header("Authorization","Bearer owner").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("url",url,"enabled",enabled))));
    }
    JsonNode configure()throws Exception {return json.readTree(save("https://shop.example/hooks",true).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");}
    UUID testEvent()throws Exception {
        return UUID.fromString(json.readTree(mvc.perform(post(BASE+"/webhook/test").header("Authorization","Bearer owner"))
            .andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString()).path("data").path("deliveryId").asText());
    }
    String state(UUID id){return db.queryForObject("select state from merchant.webhook_deliveries where id=?",String.class,id);}
    @Test void settingsSecretShownOnceEncryptedAndRotatable()throws Exception {
        var created=configure();String secret=created.path("signingSecret").asText();assertThat(secret).startsWith("whsec_");
        String stored=db.queryForObject("select secret_cipher from merchant.webhook_settings where merchant_id=?",String.class,merchant);
        assertThat(stored).doesNotContain(secret);
        String listed=mvc.perform(get(BASE+"/webhook").header("Authorization","Bearer owner")).andExpect(status().isOk())
            .andExpect(header().string("Cache-Control","no-store")).andReturn().getResponse().getContentAsString();
        assertThat(listed).doesNotContain(secret,"secret_cipher","signingSecret");
        save("https://shop.example/hooks",true).andExpect(jsonPath("$.data.signingSecret").isEmpty());
        UUID id=testEvent();
        String rotated=mvc.perform(post(BASE+"/webhook/rotate").header("Authorization","Bearer owner"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(rotated).doesNotContain(secret);assertThat(state(id)).isEqualTo("CANCELLED");
    }
    @Test void signatureCoversExactBytesTimestampAndStableEventId()throws Exception {
        String secret=configure().path("signingSecret").asText();UUID id=testEvent();Instant now=Instant.now().plusSeconds(1);
        hooks.dispatchDue(now);assertThat(state(id)).isEqualTo("DELIVERED");
        Mac hmac=Mac.getInstance("HmacSHA256");hmac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
        String expected=HexFormat.of().formatHex(hmac.doFinal((now.getEpochSecond()+"."+transport.payload).getBytes(StandardCharsets.UTF_8)));
        assertThat(transport.headers.get("X-SwiftDrop-Signature")).isEqualTo("v1="+expected);
        assertThat(transport.headers.get("X-SwiftDrop-Event-Id")).isEqualTo(id.toString());
        assertThat(json.readTree(transport.payload).path("id").asText()).isEqualTo(id.toString());
        hooks.dispatchDue(now.plusSeconds(600));assertThat(transport.calls).isEqualTo(1);
        mvc.perform(get(BASE+"/webhook/deliveries/"+id).header("Authorization","Bearer owner"))
            .andExpect(jsonPath("$.data.attempts[0].responseStatus").value(204));
    }
    @Test void exponentialRetriesArePersistedAndStopAfterSixAttempts()throws Exception {
        configure();UUID id=testEvent();transport.status=500;Instant now=Instant.now().plusSeconds(1).truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        for(int i=1;i<=6;i++) {
            hooks.dispatchDue(now);assertThat(transport.calls).isEqualTo(i);
            assertThat(state(id)).isEqualTo(i==6?"FAILED":"RETRY");
            Instant due=db.queryForObject("select next_attempt_at from merchant.webhook_deliveries where id=?",java.sql.Timestamp.class,id).toInstant();
            assertThat(due).isEqualTo(now.plusSeconds(30L*(1L<<(i-1))));
            hooks.dispatchDue(due.minusSeconds(1));assertThat(transport.calls).isEqualTo(i);now=due;
        }
        hooks.dispatchDue(now.plusSeconds(10000));assertThat(transport.calls).isEqualTo(6);
        assertThat(hooks.detail(merchant,id).attempts()).hasSize(6);
    }
    @Test void disablingOrChangingEndpointCancelsQueuedDeliveries()throws Exception {
        configure();UUID first=testEvent();save("https://shop.example/hooks",false).andExpect(status().isOk());
        hooks.dispatchDue(Instant.now().plusSeconds(1));assertThat(transport.calls).isZero();assertThat(state(first)).isEqualTo("CANCELLED");
        mvc.perform(post(BASE+"/webhook/test").header("Authorization","Bearer owner")).andExpect(status().isConflict());
        save("https://shop.example/hooks",true);UUID second=testEvent();save("https://new.example/hooks",true);
        assertThat(state(second)).isEqualTo("CANCELLED");
    }
    @Test void browserAuthorizationApprovalAndOwnedLogsAreEnforced()throws Exception {
        configure();UUID id=testEvent();
        mvc.perform(get(BASE+"/webhook/deliveries/"+id).header("Authorization","Bearer other")).andExpect(status().isNotFound());
        for(String role:List.of("customer","courier","dispatcher","admin","pending"))
            mvc.perform(get(BASE+"/webhook").header("Authorization","Bearer "+role)).andExpect(status().isForbidden());
        mvc.perform(get(BASE+"/webhook")).andExpect(status().isUnauthorized());
        var key=keys.create(new IdentityGateway.Caller(ApiKeyIntegrationTest.OWNER,"MERCHANT"),"machine").apiKey();
        mvc.perform(get(BASE+"/webhook").header("X-API-Key",key)).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE+"/webhook/deliveries?page=-1").header("Authorization","Bearer owner")).andExpect(status().isBadRequest());
    }
    @Test void orderAcceptanceEnqueuesOneEventAndBrowserOrdersAreIsolated()throws Exception {
        configure();String key=keys.create(new IdentityGateway.Caller(ApiKeyIntegrationTest.OWNER,"MERCHANT"),"orders").apiKey();
        for(int i=0;i<2;i++) mvc.perform(post(OrderIntegrationTest.PATH).header("X-API-Key",key).header("Idempotency-Key","test-checkout")
            .contentType(MediaType.APPLICATION_JSON).content(OrderIntegrationTest.BODY)).andExpect(status().is(i==0?202:200));
        assertThat(db.queryForObject("select count(*) from merchant.webhook_deliveries",Integer.class)).isEqualTo(1);
        mvc.perform(get(BASE+"/orders?status=PENDING_BOOKING").header("Authorization","Bearer owner"))
            .andExpect(jsonPath("$.data.total").value(1));
        mvc.perform(get(BASE+"/orders").header("Authorization","Bearer other")).andExpect(jsonPath("$.data.total").value(0));
        mvc.perform(get(BASE+"/orders?status=INVALID").header("Authorization","Bearer owner")).andExpect(status().isBadRequest());
    }
    @Test void identityOutageRetriesButIneligibleIdentityCancels()throws Exception {
        configure();UUID id=testEvent();identities.outage=true;Instant now=Instant.now().plusSeconds(1);hooks.dispatchDue(now);
        assertThat(state(id)).isEqualTo("RETRY");assertThat(transport.calls).isZero();
        identities.outage=false;identities.inactive=true;hooks.dispatchDue(now.plusSeconds(31));assertThat(state(id)).isEqualTo("CANCELLED");
    }
    @Test void concurrentWorkersClaimOneDeliveryAndExpiredLeasesRecover()throws Exception {
        configure();UUID id=testEvent();Instant now=Instant.now().plusSeconds(1);
        try(var executor=Executors.newFixedThreadPool(2)) {
            var a=executor.submit(()->hooks.dispatchDue(now));var b=executor.submit(()->hooks.dispatchDue(now));a.get(10,TimeUnit.SECONDS);b.get(10,TimeUnit.SECONDS);
        }
        assertThat(transport.calls).isEqualTo(1);assertThat(state(id)).isEqualTo("DELIVERED");
        UUID stranded=testEvent();db.update("update merchant.webhook_deliveries set state='SENDING',attempts=1,next_attempt_at=? where id=?",java.sql.Timestamp.from(now.minusSeconds(1)),stranded);
        hooks.dispatchDue(now);assertThat(state(stranded)).isEqualTo("DELIVERED");
    }
    @Test void testRateLimitAndUnsafeUrlsAreRejected()throws Exception {
        for(String url:List.of("http://shop.example/hook","https://user:pass@shop.example/hook","https://shop.example:8443/hook","https://shop.example/hook#x"))
            save(url,true).andExpect(status().isBadRequest());
        configure();for(int i=0;i<10;i++)testEvent();
        mvc.perform(post(BASE+"/webhook/test").header("Authorization","Bearer owner")).andExpect(status().isTooManyRequests());
        for(String address:List.of("127.0.0.1","10.0.0.1","169.254.169.254","100.64.0.1","192.168.1.1","::1","fc00::1","2001:db8::1"))
            assertThat(PublicWebhookTransport.publicAddress(InetAddress.getByName(address))).as(address).isFalse();
        assertThat(PublicWebhookTransport.publicAddress(InetAddress.getByName("8.8.8.8"))).isTrue();
    }
    @Test void networkFailuresHaveSanitizedLogsAndRetryCanSucceed()throws Exception {
        configure();UUID id=testEvent();transport.fail=true;Instant now=Instant.now().plusSeconds(1);hooks.dispatchDue(now);
        assertThat(hooks.detail(merchant,id).attempts().getFirst().outcome()).isEqualTo("NETWORK_ERROR");
        transport.fail=false;hooks.dispatchDue(now.plusSeconds(31));assertThat(state(id)).isEqualTo("DELIVERED");
    }
    @Test void encryptionRequiresConfiguredKeyAndCannotBeMovedBetweenMerchants() {
        var missing=new WebhookSecrets("");
        assertThatThrownBy(()->missing.encrypt(merchant,"secret")).isInstanceOfSatisfying(com.swiftdrop.merchant.exception.ApiFailure.class,e->assertThat(e.status()).isEqualTo(503));
        var configured=new WebhookSecrets("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
        String stored=configured.encrypt(merchant,"private-signing-secret");
        assertThat(configured.decrypt(merchant,stored)).isEqualTo("private-signing-secret");
        assertThatThrownBy(()->configured.decrypt(UUID.randomUUID(),stored)).isInstanceOf(com.swiftdrop.merchant.exception.ApiFailure.class);
    }
    @Test void merchantKubernetesWorkloadReferencesMatchingServiceAndRequiredSecrets()throws Exception {
        java.nio.file.Path path=java.nio.file.Path.of("infrastructure/kubernetes/merchant-deployment.yaml");
        if(!java.nio.file.Files.exists(path))path=java.nio.file.Path.of("../../infrastructure/kubernetes/merchant-deployment.yaml");
        var documents=new ArrayList<JsonNode>();
        for(Object object:new org.yaml.snakeyaml.Yaml().loadAll(java.nio.file.Files.readString(path)))documents.add(json.valueToTree(object));
        assertThat(documents).hasSize(2);
        var deployment=documents.getFirst();var service=documents.getLast();
        assertThat(deployment.path("spec").path("replicas").asInt()).isEqualTo(2);
        var pod=deployment.path("spec").path("template");var container=pod.path("spec").path("containers").get(0);
        assertThat(service.path("spec").path("type").asText()).isEqualTo("ClusterIP");
        assertThat(service.path("spec").path("selector")).isEqualTo(pod.path("metadata").path("labels"));
        assertThat(container.at("/resources/requests/cpu").asText()).isEqualTo("100m");
        assertThat(container.at("/resources/limits/memory").asText()).isEqualTo("512Mi");
        assertThat(container.at("/ports/0/containerPort").asInt()).isEqualTo(service.at("/spec/ports/0/targetPort").asInt());
        assertThat(container.path("envFrom").toString()).contains("merchant-config","merchant-secrets","merchant-integration-secrets","merchant-webhook-secrets");
        assertThat(container.at("/readinessProbe/httpGet/path").asText()).isEqualTo("/actuator/health/readiness");
        assertThat(container.at("/securityContext/readOnlyRootFilesystem").asBoolean()).isTrue();
    }
}

