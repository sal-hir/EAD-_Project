package com.swiftdrop.merchant;

import com.fasterxml.jackson.databind.*;
import com.swiftdrop.merchant.client.*;
import com.swiftdrop.merchant.dto.MerchantDtos.*;
import com.swiftdrop.merchant.entity.Application;
import com.swiftdrop.merchant.exception.ApiFailure;
import com.swiftdrop.merchant.repository.ApplicationRepository;
import com.swiftdrop.merchant.service.ApiKeyService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
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
@Import(ApiKeyIntegrationTest.Identities.class)
class ApiKeyIntegrationTest {
    static final UUID OWNER = UUID.randomUUID(), OTHER = UUID.randomUUID(), ADMIN = UUID.randomUUID(), PENDING = UUID.randomUUID();
    static class FakeIdentity implements IdentityGateway, MerchantIdentityGateway {
        volatile boolean inactive, outage;
        public Caller validate(String token) {
            return switch (token) {
                case "owner" -> new Caller(OWNER, "MERCHANT");
                case "other" -> new Caller(OTHER, "MERCHANT");
                case "pending" -> new Caller(PENDING, "MERCHANT");
                case "admin" -> new Caller(ADMIN, "ADMIN");
                case "customer", "courier", "dispatcher" -> new Caller(OTHER, token.toUpperCase());
                default -> throw new ApiFailure(401, "Invalid token");
            };
        }
        public void grantMerchant(String bearer, UUID application, UUID user) {}
        public void requireActiveMerchant(UUID user) {
            if (outage) throw new ApiFailure(503, "Authentication unavailable");
            if (inactive) throw new ApiFailure(401, "Merchant identity unavailable");
        }
    }
    @TestConfiguration static class Identities { @Bean @Primary FakeIdentity fakeIdentity() { return new FakeIdentity(); } }
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired JdbcTemplate db;
    @Autowired ApplicationRepository applications; @Autowired ApiKeyService keys; @Autowired FakeIdentity identities;
    UUID merchantId;
    @BeforeEach void setup() {
        db.update("delete from merchant.approval_audit"); applications.deleteAll();
        identities.inactive = false; identities.outage = false;
        merchantId = business(OWNER, true).getId(); business(OTHER, true); business(PENDING, false);
    }
    Application business(UUID user, boolean approved) {
        var application = new Application(user, new Business("Business", null, null, "Retail", "Owner", "owner@example.lk",
            "+94771234567", "1 Example Road", "Colombo", null, null));
        if (approved) application.approved();
        return applications.saveAndFlush(application);
    }
    ResultActions generate(String bearer, String body) throws Exception {
        return mvc.perform(post("/api/v1/merchants/api-keys").header("Authorization", "Bearer " + bearer)
            .contentType(MediaType.APPLICATION_JSON).content(body));
    }
    JsonNode create(String owner) throws Exception {
        return json.readTree(generate(owner, "{\"label\":\"Store integration\"}").andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString()).path("data");
    }
    ResultActions authenticate(String raw) throws Exception {
        return mvc.perform(get("/api/v1/merchant-api/identity").header("X-API-Key", raw));
    }
    @Test void randomKeyIsShownOnceAndOnlyItsHashIsStored() throws Exception {
        var first = create("owner"); var second = create("owner"); String raw = first.path("apiKey").asText();
        assertThat(raw).matches("sd_mk_[A-Za-z0-9_-]{43}").isNotEqualTo(second.path("apiKey").asText());
        String digest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
        assertThat(db.queryForObject("select key_hash from merchant.api_keys where id=?", String.class,
            UUID.fromString(first.path("credential").path("id").asText()))).isEqualTo(digest).isNotEqualTo(raw);
        String listed = mvc.perform(get("/api/v1/merchants/api-keys").header("Authorization", "Bearer owner"))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
            .andReturn().getResponse().getContentAsString();
        assertThat(listed).doesNotContain(raw, "keyHash", "key_hash", "apiKey");
        assertThat(listed).contains(first.path("credential").path("prefix").asText());
    }
    @Test void validationReturnsTrustedBusinessIdentityAndNoPrivateBusinessDetails() throws Exception {
        String raw = create("owner").path("apiKey").asText();
        authenticate(raw).andExpect(status().isOk()).andExpect(jsonPath("$.data.merchantId").value(merchantId.toString()))
            .andExpect(jsonPath("$.data.userId").value(OWNER.toString())).andExpect(jsonPath("$.data.keyId").exists())
            .andExpect(jsonPath("$.data.email").doesNotExist()).andExpect(header().string("Cache-Control", "no-store"));
    }
    @Test void revokedKeyImmediatelyFailsAndRepeatedRevocationIsIdempotent() throws Exception {
        var key = create("owner"); String id = key.path("credential").path("id").asText(), raw = key.path("apiKey").asText();
        authenticate(raw).andExpect(status().isOk());
        for (int i = 0; i < 2; i++) mvc.perform(post("/api/v1/merchants/api-keys/" + id + "/revoke")
            .header("Authorization", "Bearer owner")).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("REVOKED"));
        authenticate(raw).andExpect(status().isUnauthorized());
        assertThat(db.queryForObject("select count(*) from merchant.api_key_audit where key_id=? and action='REVOKED'", Integer.class,
            UUID.fromString(id))).isEqualTo(1);
    }
    @Test void anotherMerchantCannotInspectOrRevokeForeignKeys() throws Exception {
        var key = create("owner"); String id = key.path("credential").path("id").asText();
        mvc.perform(get("/api/v1/merchants/api-keys").header("Authorization", "Bearer other"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.keys").isEmpty());
        mvc.perform(post("/api/v1/merchants/api-keys/" + id + "/revoke").header("Authorization", "Bearer other"))
            .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/merchants/admin/applications/" + merchantId + "/api-keys").header("Authorization", "Bearer other"))
            .andExpect(status().isForbidden());
        authenticate(key.path("apiKey").asText()).andExpect(status().isOk());
    }
    @Test void adminCanInspectMetadataAndRevokeButCannotGenerateForAnotherMerchant() throws Exception {
        var key = create("owner"); String id = key.path("credential").path("id").asText();
        String base = "/api/v1/merchants/admin/applications/" + merchantId + "/api-keys";
        mvc.perform(get(base).header("Authorization", "Bearer admin")).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.keys[0].id").value(id)).andExpect(jsonPath("$.data.keys[0].apiKey").doesNotExist());
        generate("admin", "{\"label\":\"Admin\"}").andExpect(status().isForbidden());
        mvc.perform(post(base + "/" + id + "/revoke").header("Authorization", "Bearer admin")).andExpect(status().isOk());
        authenticate(key.path("apiKey").asText()).andExpect(status().isUnauthorized());
        assertThat(db.queryForObject("select revoked_by from merchant.api_keys where id=?", UUID.class, UUID.fromString(id))).isEqualTo(ADMIN);
    }
    @Test void unapprovedAndOtherRolesCannotGenerateOrBypassOwnershipUsingRequestFields() throws Exception {
        for (String role : List.of("pending", "customer", "courier", "dispatcher"))
            generate(role, "{\"label\":\"Denied\"}").andExpect(status().isForbidden());
        generate("owner", "{\"label\":\"Spoof\",\"merchantId\":\"" + merchantId + "\"}").andExpect(status().isBadRequest());
        generate("owner", "{\"label\":\" \"}").andExpect(status().isBadRequest());
        generate("owner", "{\"label\":\"" + "x".repeat(81) + "\"}").andExpect(status().isBadRequest());
    }
    @Test void invalidMissingDuplicateAndMixedCredentialsFailClosed() throws Exception {
        String raw = create("owner").path("apiKey").asText();
        mvc.perform(get("/api/v1/merchant-api/identity")).andExpect(status().isUnauthorized());
        authenticate("invalid").andExpect(status().isUnauthorized());
        authenticate("sd_mk_" + "A".repeat(43)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/merchant-api/identity").header("X-API-Key", raw, raw)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/merchant-api/identity").header("Authorization", "Bearer owner").header("X-API-Key", raw))
            .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/merchant-api/identity").param("apiKey", raw)).andExpect(status().isUnauthorized());
    }
    @Test void machineKeyCannotManageCredentialsOrCallAdministratorEndpoints() throws Exception {
        String raw = create("owner").path("apiKey").asText();
        mvc.perform(get("/api/v1/merchants/api-keys").header("X-API-Key", raw)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/merchants/admin/applications").header("X-API-Key", raw)).andExpect(status().isUnauthorized());
    }
    @Test void inactiveIdentityAuthOutageAndLostApprovalBlockPreviouslyValidKeys() throws Exception {
        var key = create("owner"); String raw = key.path("apiKey").asText();
        authenticate(raw).andExpect(status().isOk());
        identities.inactive = true; authenticate(raw).andExpect(status().isUnauthorized());
        identities.inactive = false; identities.outage = true; authenticate(raw).andExpect(status().isServiceUnavailable());
        identities.outage = false;
        db.update("update merchant.applications set status='REJECTED' where id=?", merchantId);
        authenticate(raw).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/merchants/api-keys/" + key.path("credential").path("id").asText() + "/revoke")
            .header("Authorization", "Bearer owner")).andExpect(status().isOk());
    }
    @Test void issuanceLimitIsEnforcedDuringConcurrentGenerationAndRevocationFreesSlot() throws Exception {
        for (int i = 0; i < 4; i++) create("owner");
        var executor = Executors.newFixedThreadPool(2);
        try {
            var tasks = List.<Callable<Integer>>of(() -> issue(), () -> issue());
            var outcomes = executor.invokeAll(tasks).stream().map(f -> { try { return f.get(); } catch (Exception e) { throw new RuntimeException(e); } }).toList();
            assertThat(outcomes).containsExactlyInAnyOrder(201, 409);
        } finally { executor.shutdownNow(); }
        UUID id = db.queryForObject("select id from merchant.api_keys where merchant_id=? order by created_at limit 1", UUID.class, merchantId);
        keys.revokeOwn(new IdentityGateway.Caller(OWNER, "MERCHANT"), id);
        create("owner");
    }
    int issue() {
        try { keys.create(new IdentityGateway.Caller(OWNER, "MERCHANT"), "Concurrent"); return 201; }
        catch (ApiFailure e) { return e.status(); }
    }
}
