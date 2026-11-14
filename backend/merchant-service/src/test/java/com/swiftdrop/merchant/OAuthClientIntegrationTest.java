package com.swiftdrop.merchant;

import com.fasterxml.jackson.databind.*;
import com.swiftdrop.merchant.client.IdentityGateway.Caller;
import com.swiftdrop.merchant.dto.MerchantDtos.Business;
import com.swiftdrop.merchant.entity.Application;
import com.swiftdrop.merchant.exception.ApiFailure;
import com.swiftdrop.merchant.repository.ApplicationRepository;
import com.swiftdrop.merchant.service.OAuthClientService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
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
import static com.swiftdrop.merchant.ApiKeyIntegrationTest.*;
import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
@Import(ApiKeyIntegrationTest.Identities.class)
class OAuthClientIntegrationTest {
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired JdbcTemplate db;
    @Autowired ApplicationRepository applications; @Autowired OAuthClientService clients;
    @Autowired ApiKeyIntegrationTest.FakeIdentity identities;
    UUID merchantId;
    @BeforeEach void setup() {
        db.update("delete from merchant.approval_audit"); applications.deleteAll();
        identities.inactive=false; identities.outage=false;
        merchantId=business(OWNER,true).getId(); business(OTHER,true); business(PENDING,false);
    }
    Application business(UUID user,boolean approved) {
        var application=new Application(user,new Business("OAuth business",null,null,"Retail","Owner","oauth@example.test",
            "+94771234567","1 Example Road","Colombo",null,null));
        if (approved) application.approved(); return applications.saveAndFlush(application);
    }
    JsonNode data(ResultActions result) throws Exception { return json.readTree(result.andReturn().getResponse().getContentAsString()).path("data"); }
    ResultActions manage(String bearer,String path,Object body) throws Exception {
        var request=post("/api/v1/merchants"+path).header("Authorization","Bearer "+bearer);
        if (body!=null) request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        return mvc.perform(request);
    }
    JsonNode create(String owner) throws Exception {
        return data(manage(owner,"/oauth-clients",Map.of("label","Store backend","scopes",List.of("merchant:read","orders:write"))).andExpect(status().isCreated()));
    }
    String basic(JsonNode client) {
        return "Basic "+Base64.getEncoder().encodeToString((client.path("credential").path("clientId").asText()+":"+client.path("clientSecret").asText()).getBytes(StandardCharsets.UTF_8));
    }
    ResultActions issue(JsonNode client,String scope) throws Exception {
        return mvc.perform(post("/api/v1/oauth/token").header("Authorization",basic(client)).contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .content("grant_type=client_credentials"+(scope==null?"":"&scope="+java.net.URLEncoder.encode(scope,StandardCharsets.UTF_8))));
    }
    String token(JsonNode client,String scope) throws Exception {
        return json.readTree(issue(client,scope).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("access_token").asText();
    }
    ResultActions identity(String token) throws Exception {
        return mvc.perform(get("/api/v1/merchant-api/oauth/identity").header("Authorization","Bearer "+token));
    }
    @Test void secretIsRandomShownOnceAndOnlyHashIsStored() throws Exception {
        var created=create("owner"); String raw=created.path("clientSecret").asText();
        assertThat(raw).matches("sd_cs_[A-Za-z0-9_-]{43}");
        String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
        UUID id=UUID.fromString(created.path("credential").path("id").asText());
        assertThat(db.queryForObject("select secret_hash from merchant.oauth_clients where id=?",String.class,id)).isEqualTo(hash);
        String listing=mvc.perform(get("/api/v1/merchants/oauth-clients").header("Authorization","Bearer owner"))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andReturn().getResponse().getContentAsString();
        assertThat(listing).contains(created.path("credential").path("clientId").asText()).doesNotContain(raw,"secretHash","secret_hash","clientSecret");
        assertThat(create("owner").path("clientSecret").asText()).isNotEqualTo(raw);
    }
    @Test void clientCredentialsReturnsStandardResponseAndHashOnlyTokenStorage() throws Exception {
        var client=create("owner");
        var response=issue(client,null).andExpect(status().isOk()).andExpect(jsonPath("$.token_type").value("Bearer"))
            .andExpect(jsonPath("$.expires_in").value(900)).andExpect(jsonPath("$.scope").value("merchant:read orders:write"))
            .andExpect(jsonPath("$.refresh_token").doesNotExist()).andExpect(jsonPath("$.success").doesNotExist())
            .andExpect(header().string("Cache-Control","no-store")).andExpect(header().string("Pragma","no-cache"));
        String raw=json.readTree(response.andReturn().getResponse().getContentAsString()).path("access_token").asText();
        assertThat(raw).matches("sd_at_[A-Za-z0-9_-]{43}");
        String stored=db.queryForObject("select token_hash from merchant.oauth_access_tokens",String.class);
        assertThat(stored).matches("[a-f0-9]{64}").doesNotContain(raw);
        identity(raw).andExpect(status().isOk()).andExpect(jsonPath("$.data.merchantId").value(merchantId.toString()))
            .andExpect(jsonPath("$.data.userId").value(OWNER.toString())).andExpect(jsonPath("$.data.audience").value(OAuthClientService.AUDIENCE));
    }
    @Test void issuedScopesAreSubsetAndRequiredScopesAreEnforced() throws Exception {
        var client=create("owner"); String read=token(client,"merchant:read");
        identity(read).andExpect(status().isOk());
        mvc.perform(get("/api/v1/merchant-api/oauth/identity").header("Authorization","bearer "+read)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/merchant-api/oauth/authorize").header("Authorization","Bearer "+read)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/merchant-api/oauth/authorize").param("scope","orders:write").header("Authorization","Bearer "+read))
            .andExpect(status().isForbidden()).andExpect(header().string("WWW-Authenticate",containsString("insufficient_scope")));
        String write=token(client,"orders:write"); identity(write).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/merchant-api/oauth/authorize").param("scope","orders:write").header("Authorization","Bearer "+write))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.clientId").value(client.path("credential").path("clientId").asText()));
        issue(client,"admin").andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("invalid_scope"));
        issue(client,"").andExpect(status().isBadRequest());
        var readOnly=data(manage("owner","/oauth-clients",Map.of("label","Read only","scopes",List.of("merchant:read"))).andExpect(status().isCreated()));
        issue(readOnly,"orders:write").andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("invalid_scope"));
    }
    @Test void invalidClientAuthenticationAndUnsupportedGrantsReturnOAuthErrors() throws Exception {
        var client=create("owner");
        mvc.perform(post("/api/v1/oauth/token").contentType(MediaType.APPLICATION_FORM_URLENCODED).content("grant_type=client_credentials"))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("invalid_client"))
            .andExpect(header().string("WWW-Authenticate",containsString("Basic")));
        mvc.perform(post("/api/v1/oauth/token").header("Authorization","Basic !!!").contentType(MediaType.APPLICATION_FORM_URLENCODED).content("grant_type=client_credentials"))
            .andExpect(status().isUnauthorized());
        for (String grant : List.of("password","refresh_token","authorization_code"))
            mvc.perform(post("/api/v1/oauth/token").header("Authorization",basic(client)).contentType(MediaType.APPLICATION_FORM_URLENCODED).content("grant_type="+grant))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("unsupported_grant_type"));
        mvc.perform(post("/api/v1/oauth/token").header("Authorization",basic(client)).contentType(MediaType.APPLICATION_FORM_URLENCODED).content("scope=merchant%3Aread"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("invalid_request"));
        mvc.perform(post("/api/v1/oauth/token").header("Authorization",basic(client)).contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .content("grant_type=client_credentials&grant_type=client_credentials")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/oauth/token").header("Authorization",basic(client)).contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .content("grant_type=client_credentials&client_secret=not-supported")).andExpect(status().isBadRequest());
        var invalid=client.deepCopy(); ((com.fasterxml.jackson.databind.node.ObjectNode)invalid).put("clientSecret","sd_cs_"+"A".repeat(43));
        issue(invalid,null).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("invalid_client"));
    }
    @Test void rotationInvalidatesPreviousSecretAndEveryIssuedToken() throws Exception {
        var original=create("owner"); String first=token(original,null), second=token(original,"merchant:read");
        String id=original.path("credential").path("id").asText();
        var rotated=data(manage("owner","/oauth-clients/"+id+"/rotate",null).andExpect(status().isOk()));
        assertThat(rotated.path("credential").path("clientId").asText()).isEqualTo(original.path("credential").path("clientId").asText());
        assertThat(rotated.path("clientSecret").asText()).isNotEqualTo(original.path("clientSecret").asText());
        issue(original,null).andExpect(status().isUnauthorized()); identity(first).andExpect(status().isUnauthorized()); identity(second).andExpect(status().isUnauthorized());
        identity(token(rotated,null)).andExpect(status().isOk());
    }
    @Test void merchantAndAdminRevocationAreImmediateAndIdempotent() throws Exception {
        for (String actor : List.of("owner","admin")) {
            var client=create("owner"); String raw=token(client,null), id=client.path("credential").path("id").asText();
            String path=(actor.equals("admin")?"/admin/applications/"+merchantId:"")+"/oauth-clients/"+id+"/revoke";
            for (int i=0;i<2;i++) manage(actor,path,null).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("REVOKED"));
            issue(client,null).andExpect(status().isUnauthorized()); identity(raw).andExpect(status().isUnauthorized());
            manage("owner","/oauth-clients/"+id+"/rotate",null).andExpect(status().isConflict());
            assertThat(db.queryForObject("select count(*) from merchant.oauth_client_audit where client_id=? and action='REVOKED'",Integer.class,UUID.fromString(id))).isEqualTo(1);
        }
    }
    @Test void ownershipAndBrowserRolesPreventCrossMerchantCredentialManagement() throws Exception {
        var client=create("owner"); String id=client.path("credential").path("id").asText();
        for (String operation : List.of("rotate","revoke")) manage("other","/oauth-clients/"+id+"/"+operation,null).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/merchants/oauth-clients").header("Authorization","Bearer other")).andExpect(status().isOk()).andExpect(jsonPath("$.data.clients").isEmpty());
        for (String role : List.of("pending","customer","courier","dispatcher","admin"))
            manage(role,"/oauth-clients",Map.of("label","Denied","scopes",List.of("merchant:read"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/merchants/admin/applications/"+merchantId+"/oauth-clients").header("Authorization","Bearer other")).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/merchants/admin/applications/"+merchantId+"/oauth-clients").header("Authorization","Bearer admin"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.clients[0].clientSecret").doesNotExist());
    }
    @Test void expiredWrongAudienceAndUnknownTokensAreRejected() throws Exception {
        var client=create("owner"); String raw=token(client,null);
        db.update("update merchant.oauth_access_tokens set expires_at=?",java.sql.Timestamp.from(java.time.Instant.now().minusSeconds(1)));
        identity(raw).andExpect(status().isUnauthorized()).andExpect(header().string("WWW-Authenticate",containsString("invalid_token")));
        clients.removeExpiredTokens(); assertThat(db.queryForObject("select count(*) from merchant.oauth_access_tokens",Integer.class)).isZero();
        String wrongAudience=token(client,null); db.update("update merchant.oauth_access_tokens set audience='browser-login'");
        identity(wrongAudience).andExpect(status().isUnauthorized()); identity("sd_at_"+"B".repeat(43)).andExpect(status().isUnauthorized());
    }
    @Test void inactiveMerchantAndAuthOutageBlockIssuanceAndExistingTokens() throws Exception {
        var client=create("owner"); String raw=token(client,null);
        identities.inactive=true; issue(client,null).andExpect(status().isUnauthorized()); identity(raw).andExpect(status().isUnauthorized());
        identities.inactive=false; identities.outage=true;
        issue(client,null).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error").value("temporarily_unavailable"));
        identity(raw).andExpect(status().isServiceUnavailable()); identities.outage=false;
        db.update("update merchant.applications set status='REJECTED' where id=?",merchantId);
        issue(client,null).andExpect(status().isUnauthorized()); identity(raw).andExpect(status().isUnauthorized());
        manage("owner","/oauth-clients/"+client.path("credential").path("id").asText()+"/revoke",null).andExpect(status().isOk());
    }
    @Test void machineTokensApiKeysAndBrowserJwtCannotBeInterchanged() throws Exception {
        String raw=token(create("owner"),null);
        mvc.perform(get("/api/v1/merchants/oauth-clients").header("Authorization","Bearer "+raw)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/merchants/admin/applications").header("Authorization","Bearer "+raw)).andExpect(status().isUnauthorized());
        identity("owner").andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/merchant-api/oauth/identity").header("X-API-Key","sd_mk_"+"A".repeat(43))).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/merchant-api/oauth/identity").param("access_token",raw)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/merchant-api/oauth/identity").header("Authorization","Bearer "+raw).header("X-API-Key","mixed"))
            .andExpect(status().isUnauthorized());
    }
    @Test void generationRejectsInjectedIdentityAndUnsupportedScopes() throws Exception {
        manage("owner","/oauth-clients",Map.of("label","Escalation","scopes",List.of("admin"))).andExpect(status().isBadRequest());
        manage("owner","/oauth-clients",Map.of("label","None","scopes",List.of())).andExpect(status().isBadRequest());
        manage("owner","/oauth-clients",Map.of("label","Injected","scopes",List.of("merchant:read"),"merchantId",merchantId)).andExpect(status().isBadRequest());
    }
    @Test void emptyAndMixedTokenRequestsAreRejectedAndTokenCountIsBounded() throws Exception {
        var client=create("owner");
        mvc.perform(post("/api/v1/oauth/token").header("Authorization",basic(client)).contentType(MediaType.APPLICATION_FORM_URLENCODED).content(""))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("invalid_request"));
        mvc.perform(post("/api/v1/oauth/token").header("Authorization",basic(client),basic(client))
            .contentType(MediaType.APPLICATION_FORM_URLENCODED).content("grant_type=client_credentials")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/oauth/token").header("Authorization",basic(client)).header("X-API-Key","mixed")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED).content("grant_type=client_credentials")).andExpect(status().isBadRequest());
        UUID id=UUID.fromString(client.path("credential").path("id").asText());
        var now=java.time.Instant.now();
        for(int i=0;i<100;i++) db.update("insert into merchant.oauth_access_tokens(token_hash,client_id,credential_version,scopes,audience,created_at,expires_at) values(?,?,0,?,?,?,?)",
            String.format("%064x",i),id,"merchant:read",OAuthClientService.AUDIENCE,java.sql.Timestamp.from(now),java.sql.Timestamp.from(now.plusSeconds(900)));
        issue(client,null).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error").value("temporarily_unavailable"));
    }
    @Test void concurrentCreationEnforcesFiveActiveClients() throws Exception {
        for (int i=0;i<4;i++) create("owner");
        var pool=Executors.newFixedThreadPool(2);
        try {
            var results=pool.invokeAll(List.<Callable<Integer>>of(()->createDirect(),()->createDirect()));
            assertThat(List.of(results.get(0).get(),results.get(1).get())).containsExactlyInAnyOrder(201,409);
        } finally { pool.shutdownNow(); }
    }
    int createDirect() {
        try { clients.create(new Caller(OWNER,"MERCHANT"),"Concurrent",List.of("merchant:read")); return 201; }
        catch (ApiFailure failure) { return failure.status(); }
    }
}
