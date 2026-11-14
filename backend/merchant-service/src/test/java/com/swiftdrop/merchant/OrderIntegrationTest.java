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
    @Test void trackingSchemaIsExplicitAndStableWhileBookingIsPending() throws Exception {
        String id=create();
        String first=mvc.perform(get(PATH+"/"+id+"/tracking").header("X-API-Key",key)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.trackingAvailable").value(false))
            .andExpect(jsonPath("$.data.parcelId").isEmpty())
            .andExpect(jsonPath("$.data.trackingNumber").isEmpty())
            .andExpect(jsonPath("$.data.updatedAt").isNotEmpty())
            .andExpect(jsonPath("$.data.events.length()").value(1))
            .andExpect(jsonPath("$.data.events[0].status").value("PENDING_BOOKING"))
            .andReturn().getResponse().getContentAsString();
        String second=mvc.perform(get(PATH+"/"+id+"/tracking").header("X-API-Key",key))
            .andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(first)).isEqualTo(json.readTree(second));
    }
    @Test void malformedRequestsReturnConsistentErrorsAndAreNeverPersisted() throws Exception {
        for(String body:List.of("{",BODY.replace("+94771234567","-------"),BODY.replace("Colombo"," "),
                BODY.replace("1.5","1000.001"),BODY.replace("\"heightCm\":10","\"heightCm\":null"),
                BODY.replace("\"serviceType\":\"STANDARD\"","\"serviceType\":\"EXPRESS\",\"serviceType\":\"STANDARD\""),
                BODY.replace("\"name\":\"Shop\"","\"secret\":\"injected\",\"name\":\"Shop\""))) {
            submit(key,"validation",body).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.timestamp").exists()).andExpect(header().string("Cache-Control","no-store"));
        }
        submit(key,"validation",BODY.replace("1.5","0")).andExpect(jsonPath("$.errors['parcel.weightKg']").exists());
        mvc.perform(post(PATH).header("X-API-Key",key).header("Idempotency-Key","one","two")
            .contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isBadRequest());
        for(String query:List.of("?page=-1","?page=abc","?size=0","?page=1000001"))
            mvc.perform(get(PATH+query).header("X-API-Key",key)).andExpect(status().isBadRequest());
        assertThat(db.queryForObject("select count(*) from merchant.orders",Integer.class)).isZero();
    }
    @Test void unsupportedMethodsAndMediaTypesHaveCorrectStatus() throws Exception {
        mvc.perform(put(PATH).header("X-API-Key",key).contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isMethodNotAllowed()).andExpect(header().exists("Allow"))
            .andExpect(jsonPath("$.status").value(405));
        mvc.perform(post(PATH).header("X-API-Key",key).header("Idempotency-Key","media")
            .contentType(MediaType.TEXT_PLAIN).content(BODY)).andExpect(status().isUnsupportedMediaType())
            .andExpect(jsonPath("$.status").value(415));
    }
    @Test void duplicateCredentialsAreRejectedAndErrorsAreNotCacheable() throws Exception {
        mvc.perform(get(PATH).header("X-API-Key",key,otherKey)).andExpect(status().isUnauthorized())
            .andExpect(header().string("Cache-Control","no-store"));
        mvc.perform(get(PATH).header("Authorization","Bearer bogus","Bearer bogus"))
            .andExpect(status().isUnauthorized()).andExpect(header().exists("WWW-Authenticate"));
    }
    @Test void persistedOrderCanBeSubmittedToMockWithoutChangingLiveBookingState() throws Exception {
        String id=create();
        var order=json.readTree(mvc.perform(get(PATH+"/"+id).header("X-API-Key",key))
            .andReturn().getResponse().getContentAsString()).path("data");
        try(var mock=new MockBookingServer(json)) {
            var gateway=new com.swiftdrop.merchant.client.HttpBookingGateway(mock.endpoint(),"mock-private-service-key",json,java.time.Duration.ofSeconds(2));
            var request=new com.swiftdrop.merchant.client.BookingGateway.Request(UUID.fromString(id),
                UUID.fromString(order.path("merchantId").asText()),json.treeToValue(order.path("request"),com.swiftdrop.merchant.dto.OrderDtos.Create.class));
            var booking=gateway.create(request);
            assertThat(booking.orderId()).isEqualTo(UUID.fromString(id));
            assertThat(gateway.create(request).parcelId()).isEqualTo(booking.parcelId());
            assertThat(mock.created.get()).isEqualTo(1);
        }
        mvc.perform(get(PATH+"/"+id+"/tracking").header("X-API-Key",key))
            .andExpect(jsonPath("$.data.trackingAvailable").value(false))
            .andExpect(jsonPath("$.data.status").value("PENDING_BOOKING"));
    }
    java.nio.file.Path artifact(String relative) {
        for(String root:List.of("docs","../../docs")) {
            var path=java.nio.file.Path.of(root,relative);
            if(java.nio.file.Files.exists(path)) return path;
        }
        throw new IllegalStateException("Missing documentation artifact: "+relative);
    }
    @Test void everyPostmanRequestMatchesTheImplementedApiIncludingOptionalNegativeCases() throws Exception {
        var collection=json.readTree(java.nio.file.Files.readString(artifact("postman/merchant-orders.postman_collection.json")));
        var client=oauth.create(caller(ApiKeyIntegrationTest.OWNER),"Postman",List.of("merchant:read","orders:write"));
        String expired=oauth.issue(client.credential().clientId(),client.clientSecret(),null).accessToken();
        db.update("update merchant.oauth_access_tokens set expires_at=?",java.sql.Timestamp.from(java.time.Instant.now().minusSeconds(1)));
        String token=oauth.issue(client.credential().clientId(),client.clientSecret(),null).accessToken();
        String readonly=oauth.issue(client.credential().clientId(),client.clientSecret(),"merchant:read").accessToken();
        var revoked=keys.create(caller(ApiKeyIntegrationTest.OWNER),"Revoked Postman");
        keys.revokeOwn(caller(ApiKeyIntegrationTest.OWNER),revoked.credential().id());
        Map<String,String> variables=new HashMap<>(Map.of("apiKey",key,"accessToken",token,"otherApiKey",otherKey,
            "readOnlyAccessToken",readonly,"expiredAccessToken",expired,"revokedApiKey",revoked.apiKey(),
            "merchantOrderId","SHOP-123","idempotencyKey","checkout-123","baseUrl",""));
        int requests=0;
        for(var folder:collection.path("item")) for(var item:folder.path("item")) {
            var definition=item.path("request");
            String url=replaceVariables(definition.path("url").asText(),variables).replace("{{$guid}}",UUID.randomUUID().toString());
            var builder=request(org.springframework.http.HttpMethod.valueOf(definition.path("method").asText()),url);
            if(folder.path("auth").path("type").asText().equals("apikey")) builder.header("X-API-Key",key);
            if(folder.path("auth").path("type").asText().equals("bearer")) builder.header("Authorization","Bearer "+token);
            for(var header:definition.path("header")) builder.header(header.path("key").asText(),replaceVariables(header.path("value").asText(),variables));
            if(definition.has("body")) builder.content(replaceVariables(definition.path("body").path("raw").asText(),variables));
            var response=mvc.perform(builder).andReturn().getResponse();
            boolean negative=folder.path("name").asText().startsWith("Negative");
            if(negative) {
                String scripts=item.path("event").toString();
                var expected=java.util.regex.Pattern.compile("have.status\\((\\d+)\\)").matcher(scripts);
                assertThat(expected.find()).as(item.path("name").asText()).isTrue();
                int code=Integer.parseInt(expected.group(1));
                assertThat(response.getStatus()).as(item.path("name").asText()+": "+response.getContentAsString()).isEqualTo(code);
                assertThat(json.readTree(response.getContentAsString()).path("status").asInt()).isEqualTo(code);
            } else if(definition.path("method").asText().equals("POST")) {
                assertThat(response.getStatus()).isIn(200,202);
                variables.put("orderId",json.readTree(response.getContentAsString()).path("data").path("id").asText());
            } else assertThat(response.getStatus()).as(item.path("name").asText()).isEqualTo(200);
            assertThat(response.getHeader("Cache-Control")).isEqualTo("no-store"); requests++;
        }
        assertThat(requests).isEqualTo(33);
    }
    String replaceVariables(String input,Map<String,String> variables) {
        for(var entry:variables.entrySet()) input=input.replace("{{"+entry.getKey()+"}}",entry.getValue());
        return input;
    }
    @Test void openApiReferencesExampleAndRequiredResponseFieldsMatchTheApi() throws Exception {
        Object yaml=new org.yaml.snakeyaml.Yaml().load(java.nio.file.Files.readString(artifact("openapi/merchant-orders.yaml")));
        JsonNode spec=json.valueToTree(yaml);
        assertThat(spec.path("openapi").asText()).isEqualTo("3.0.3");
        verifyReferences(spec,spec);
        var paths=spec.path("paths");
        var example=paths.path(PATH).path("post").path("requestBody").path("content").path("application/json").path("example");
        var created=submit(key,"openapi-example",json.writeValueAsString(example)).andExpect(status().isAccepted()).andReturn().getResponse();
        var order=json.readTree(created.getContentAsString()); String id=order.path("data").path("id").asText();
        assertRequiredFields(spec,paths.path(PATH).path("post").path("responses").path("202").path("content").path("application/json").path("schema"),order);
        for(String suffix:List.of("", "/"+id,"/"+id+"/tracking")) {
            var response=json.readTree(mvc.perform(get(PATH+suffix).header("X-API-Key",key)).andReturn().getResponse().getContentAsString());
            String documentedPath=suffix.isEmpty()?PATH:PATH+"/{id}"+(suffix.endsWith("/tracking")?"/tracking":"");
            var schema=paths.path(documentedPath).path("get").path("responses").path("200").path("content").path("application/json").path("schema");
            assertRequiredFields(spec,schema,response);
        }
    }
    void verifyReferences(JsonNode root,JsonNode node) {
        if(node.has("$ref")) {
            String ref=node.path("$ref").asText();
            assertThat(ref).startsWith("#/");
            assertThat(root.at(ref.substring(1)).isMissingNode()).as(ref).isFalse();
        }
        if(node.has("pattern")) java.util.regex.Pattern.compile(node.path("pattern").asText());
        node.forEach(child->{if(child.isContainerNode()) verifyReferences(root,child);});
    }
    void assertRequiredFields(JsonNode root,JsonNode schema,JsonNode actual) {
        assertThat(schema.isMissingNode()).isFalse();
        if(schema.has("$ref")) schema=root.at(schema.path("$ref").asText().substring(1));
        if(actual.isNull()) { assertThat(schema.path("nullable").asBoolean()).isTrue();return; }
        for(var required:schema.path("required")) assertThat(actual.has(required.asText())).as(required.asText()).isTrue();
        if(actual.isObject()) {
            var properties=schema.path("properties");
            var names=actual.fieldNames();
            while(names.hasNext()) {
                String name=names.next();
                assertThat(properties.has(name)).as("Documented field: "+name).isTrue();
                assertRequiredFields(root,properties.path(name),actual.path(name));
            }
        } else if(actual.isArray()) for(var item:actual) assertRequiredFields(root,schema.path("items"),item);
    }
}
