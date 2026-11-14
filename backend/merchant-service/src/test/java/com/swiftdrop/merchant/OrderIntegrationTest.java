package com.swiftdrop.merchant;

import com.fasterxml.jackson.databind.*;
import com.swiftdrop.merchant.client.IdentityGateway.Caller;
import com.swiftdrop.merchant.dto.MerchantDtos.Business;
import com.swiftdrop.merchant.entity.Application;
import com.swiftdrop.merchant.repository.ApplicationRepository;
import com.swiftdrop.merchant.service.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
@Import(ApiKeyIntegrationTest.Identities.class)
class OrderIntegrationTest {
    static final String PATH="/api/v1/merchant/orders";
    static final String BODY="""
        {"merchantOrderId":"SHOP-123","pickup":{"name":"Shop","phone":"+94771234567","address":"1 Main Road","district":"Colombo"},
         "recipient":{"name":"Customer","phone":"+94771234568","address":"2 Lake Road","district":"Galle"},
         "parcel":{"description":"Books","weightKg":1.5,"lengthCm":20,"widthCm":15,"heightCm":10},"serviceType":"STANDARD"}
        """;
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired JdbcTemplate db;
    @Autowired ApplicationRepository applications; @Autowired ApiKeyService keys;
    @Autowired OAuthClientService oauth; @Autowired ApiKeyIntegrationTest.FakeIdentity identities;
    String key,otherKey;
    @BeforeEach void setup() {
        db.update("delete from merchant.approval_audit"); applications.deleteAll();
        identities.inactive=false; identities.outage=false;
        for(UUID owner:List.of(ApiKeyIntegrationTest.OWNER,ApiKeyIntegrationTest.OTHER)) {
            var business=new Application(owner,new Business("Shop",null,null,"Retail","Owner","shop@example.lk",
                "+94771234567","Main Road","Colombo",null,null));
            business.approved(); applications.saveAndFlush(business);
        }
        key=keys.create(caller(ApiKeyIntegrationTest.OWNER),"Store").apiKey();
        otherKey=keys.create(caller(ApiKeyIntegrationTest.OTHER),"Other").apiKey();
    }
    Caller caller(UUID owner) { return new Caller(owner,"MERCHANT"); }
    ResultActions submit(String credential,String idempotency,String body) throws Exception {
        return mvc.perform(post(PATH).header("X-API-Key",credential).header("Idempotency-Key",idempotency)
            .contentType(MediaType.APPLICATION_JSON).content(body));
    }
    String create() throws Exception {
        return json.readTree(submit(key,"checkout-123",BODY).andExpect(status().isAccepted())
            .andExpect(jsonPath("$.data.status").value("PENDING_BOOKING"))
            .andExpect(jsonPath("$.data.trackingNumber").isEmpty())
            .andReturn().getResponse().getContentAsString()).path("data").path("id").asText();
    }
    @Test void acceptedOrderCanBeListedReadAndTrackedWithoutInventingABooking() throws Exception {
        String id=create();
        mvc.perform(get(PATH).header("X-API-Key",key)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.total").value(1)).andExpect(header().string("Cache-Control","no-store"));
        mvc.perform(get(PATH+"/"+id).header("X-API-Key",key)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.request.merchantOrderId").value("SHOP-123"));
        mvc.perform(get(PATH+"/"+id+"/tracking").header("X-API-Key",key)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("PENDING_BOOKING"));
    }
    @Test void retryReturnsSameOrderAndChangedRequestsConflict() throws Exception {
        String id=create();
        submit(key,"checkout-123",BODY).andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(id))
            .andExpect(header().string("Idempotency-Replayed","true"));
        submit(key,"checkout-123",BODY.replace("Books","Shoes")).andExpect(status().isConflict());
        submit(key,"new-key",BODY).andExpect(status().isConflict());
        submit(key,"checkout-123",BODY.replace("SHOP-123","SHOP-456")).andExpect(status().isConflict());
        submit(key,"checkout-123",BODY.replace("1.5","1.500")).andExpect(status().isOk());
    }
    @Test void foreignAndMissingOrdersAreIndistinguishable() throws Exception {
        String id=create();
        for(String suffix:List.of("/"+id,"/"+id+"/tracking","/"+UUID.randomUUID()))
            mvc.perform(get(PATH+suffix).header("X-API-Key",otherKey)).andExpect(status().isNotFound());
        mvc.perform(get(PATH).header("X-API-Key",otherKey)).andExpect(jsonPath("$.data.total").value(0));
        submit(otherKey,"checkout-123",BODY).andExpect(status().isAccepted());
    }
    @Test void invalidPayloadKeysAndPaginationAreRejected() throws Exception {
        for(String body:List.of("{}",BODY.replace("1.5","0"),BODY.replace("STANDARD","UNKNOWN"),
                BODY.replace("\"merchantOrderId\"","\"merchantId\":\"injected\",\"merchantOrderId\"")))
            submit(key,"valid-key",body).andExpect(status().isBadRequest());
        mvc.perform(post(PATH).header("X-API-Key",key).contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isBadRequest());
        mvc.perform(get(PATH+"?size=101").header("X-API-Key",key)).andExpect(status().isBadRequest());
        mvc.perform(get(PATH+"/not-a-uuid").header("X-API-Key",key)).andExpect(status().isBadRequest());
    }
    @Test void authenticationFailsClosedIncludingRevocationAndOutage() throws Exception {
        mvc.perform(get(PATH)).andExpect(status().isUnauthorized());
        mvc.perform(get(PATH).header("Authorization","Bearer owner")).andExpect(status().isUnauthorized());
        mvc.perform(get(PATH).header("Authorization","Bearer bogus").header("X-API-Key",key)).andExpect(status().isUnauthorized());
        identities.outage=true;
        submit(key,"checkout-123",BODY).andExpect(status().isServiceUnavailable());
        identities.outage=false; identities.inactive=true;
        submit(key,"checkout-123",BODY).andExpect(status().isUnauthorized());
        identities.inactive=false;
        var credential=keys.create(caller(ApiKeyIntegrationTest.OWNER),"Revocable");
        keys.revokeOwn(caller(ApiKeyIntegrationTest.OWNER),credential.credential().id());
        submit(credential.apiKey(),"checkout-123",BODY).andExpect(status().isUnauthorized());
        assertThat(db.queryForObject("select count(*) from merchant.orders",Integer.class)).isZero();
    }
    @Test void oauthRequiresWriteForCreateAndReadForRetrievalAndHonorsRevocation() throws Exception {
        var client=oauth.create(caller(ApiKeyIntegrationTest.OWNER),"Shop",List.of("merchant:read","orders:write"));
        String token=oauth.issue(client.credential().clientId(),client.clientSecret(),null).accessToken();
        mvc.perform(post(PATH).header("Authorization","Bearer "+token).header("Idempotency-Key","oauth-checkout")
            .contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isAccepted());
        mvc.perform(get(PATH).header("Authorization","Bearer "+token)).andExpect(status().isOk());
        String read=oauth.issue(client.credential().clientId(),client.clientSecret(),"merchant:read").accessToken();
        mvc.perform(post(PATH).header("Authorization","Bearer "+read).contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isForbidden()).andExpect(header().exists("WWW-Authenticate"));
        String write=oauth.issue(client.credential().clientId(),client.clientSecret(),"orders:write").accessToken();
        mvc.perform(get(PATH).header("Authorization","Bearer "+write)).andExpect(status().isForbidden());
        db.update("update merchant.oauth_access_tokens set expires_at=?",java.sql.Timestamp.from(java.time.Instant.now().minusSeconds(1)));
        mvc.perform(get(PATH).header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized());
        String fresh=oauth.issue(client.credential().clientId(),client.clientSecret(),null).accessToken();
        oauth.revokeOwn(caller(ApiKeyIntegrationTest.OWNER),client.credential().id());
        mvc.perform(get(PATH).header("Authorization","Bearer "+fresh)).andExpect(status().isUnauthorized());
    }
    @Test void simultaneousRetriesCreateOnlyOneOrder() throws Exception {
        try(var executor=Executors.newFixedThreadPool(4)) {
            var results=new ArrayList<Future<MvcResult>>();
            for(int i=0;i<4;i++) results.add(executor.submit(()->submit(key,"same-key",BODY).andReturn()));
            Set<String> ids=new HashSet<>(); int accepted=0;
            for(var future:results) {
                var response=future.get(15,TimeUnit.SECONDS).getResponse();
                assertThat(response.getStatus()).isIn(200,202);
                if(response.getStatus()==202) accepted++;
                ids.add(json.readTree(response.getContentAsString()).path("data").path("id").asText());
            }
            assertThat(accepted).isEqualTo(1); assertThat(ids).hasSize(1);
        }
    }
}
