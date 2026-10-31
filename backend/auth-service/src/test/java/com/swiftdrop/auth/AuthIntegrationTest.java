package com.swiftdrop.auth;

import com.fasterxml.jackson.databind.*;
import com.swiftdrop.auth.entity.*;
import com.swiftdrop.auth.repository.*;
import com.swiftdrop.auth.security.JwtService;
import com.swiftdrop.auth.service.OAuthService;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired OAuthCodeRepository codes;
    @Autowired PasswordEncoder passwords;
    @Autowired JwtEncoder encoder;
    @Autowired JwtService jwt;
    @Autowired OAuthService oauth;
    static final String EMAIL = "customer@example.lk";
    static final String PASSWORD = "Customer@123!";
    @BeforeEach void clean() { codes.deleteAll(); users.deleteAll(); }
    Map<String, Object> registration() {
        return new HashMap<>(Map.of("name", "Kamal Perera", "email", EMAIL, "password", PASSWORD));
    }
    ResultActions register(Map<String, Object> body) throws Exception { return mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body))); }
    ResultActions login(String email, String password) throws Exception {
        return mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(Map.of("email", email, "password", password))));
    }
    User customer() throws Exception { register(registration()).andExpect(status().isCreated()); return users.findByEmail(EMAIL).orElseThrow(); }
    String token() throws Exception {
        String body = login(EMAIL, PASSWORD).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).path("data").path("token").asText();
    }
    @Test void registrationHashesPasswordAndDoesNotLeakSecrets() throws Exception {
        register(registration()).andExpect(status().isCreated()).andExpect(jsonPath("$.data.role").value("CUSTOMER"))
            .andExpect(jsonPath("$.data.passwordHash").doesNotExist()).andExpect(jsonPath("$.data.password").doesNotExist());
        User user = users.findByEmail(EMAIL).orElseThrow();
        assertThat(user.getId()).isNotNull();
        assertThat(user.getPasswordHash()).isNotEqualTo(PASSWORD).startsWith("$2");
        assertThat(passwords.matches(PASSWORD, user.getPasswordHash())).isTrue();
        assertThat(user.getCreatedAt()).isNotNull();
    }
    @Test void duplicateEmailIsCaseInsensitive() throws Exception {
        customer(); var body = registration(); body.put("email", EMAIL.toUpperCase(Locale.ROOT));
        register(body).andExpect(status().isConflict());
        assertThat(users.count()).isEqualTo(1);
    }
    @ParameterizedTest @ValueSource(strings = {"ADMIN", "DISPATCHER", "COURIER", "MERCHANT"})
    void publicRegistrationRejectsOtherRoles(String role) throws Exception {
        var body = registration(); body.put("role", role);
        register(body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.role").exists());
        assertThat(users.count()).isZero();
    }
    @Test void invalidRegistrationAndUnknownFieldsAreRejected() throws Exception {
        var body = registration(); body.put("password", "short"); body.put("email", "invalid");
        register(body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.email").exists());
        body = registration(); body.put("active", true);
        register(body).andExpect(status().isBadRequest());
    }
    @Test void successfulLoginAndCurrentUser() throws Exception {
        customer();
        login(EMAIL, PASSWORD).andExpect(status().isOk()).andExpect(jsonPath("$.data.expiresIn").value(900))
            .andExpect(jsonPath("$.data.tokenType").value("Bearer")).andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.data.user.passwordHash").doesNotExist());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.email").value(EMAIL));
    }
    @Test void incorrectAndUnknownCredentialsHaveSameResponse() throws Exception {
        customer();
        String known = login(EMAIL, "incorrect").andExpect(status().isUnauthorized()).andReturn().getResponse().getContentAsString();
        String unknown = login("absent@example.lk", "incorrect").andExpect(status().isUnauthorized()).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(known).path("message")).isEqualTo(json.readTree(unknown).path("message"));
    }
    @Test void missingAndInvalidJwtAreRejected() throws Exception {
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer broken.token.value")).andExpect(status().isUnauthorized());
    }
    String customToken(User user, Instant expiry, String issuer, List<String> audience, String subject) {
        var claims = JwtClaimsSet.builder().issuer(issuer).subject(subject).audience(audience)
            .issuedAt(Instant.now().minusSeconds(120)).expiresAt(expiry).claim("role", "ADMIN").build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }
    @Test void expiredWrongIssuerWrongAudienceAndMalformedSubjectAreRejected() throws Exception {
        User user = customer();
        var tokens = List.of(
            customToken(user, Instant.now().minusSeconds(1), "swiftdrop-auth", List.of("swiftdrop-api"), user.getId().toString()),
            customToken(user, Instant.now().plusSeconds(120), "wrong", List.of("swiftdrop-api"), user.getId().toString()),
            customToken(user, Instant.now().plusSeconds(120), "swiftdrop-auth", List.of("wrong"), user.getId().toString()),
            customToken(user, Instant.now().plusSeconds(120), "swiftdrop-auth", List.of("swiftdrop-api"), "invalid"));
        for (String token : tokens) mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }
    @Test void tamperedSignatureIsRejected() throws Exception {
        customer(); String valid = token();
        String[] parts = valid.split("\\.");
        String forged = parts[0] + "." + parts[1] + "." + (parts[2].startsWith("A") ? "B" : "A") + parts[2].substring(1);
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + forged)).andExpect(status().isUnauthorized());
    }
    @Test void databaseRoleOverridesClaimsAndChangesApplyImmediately() throws Exception {
        User user = customer();
        String token = customToken(user, Instant.now().plusSeconds(120), "swiftdrop-auth", List.of("swiftdrop-api"), user.getId().toString());
        mvc.perform(get("/api/v1/auth/admin/me").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        user.setRole(Role.ADMIN); users.saveAndFlush(user);
        mvc.perform(get("/api/v1/auth/admin/me").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        user.setRole(Role.CUSTOMER); users.saveAndFlush(user);
        mvc.perform(get("/api/v1/auth/admin/me").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }
    @Test void dispatcherHasStaffAccess() throws Exception {
        User user = customer(); user.setRole(Role.DISPATCHER); users.saveAndFlush(user);
        mvc.perform(get("/api/v1/auth/admin/me").header("Authorization", "Bearer " + token())).andExpect(status().isOk());
    }
    @Test void inactiveAccountCannotLoginOrReuseToken() throws Exception {
        User user = customer(); String token = token(); user.setActive(false); users.saveAndFlush(user);
        login(EMAIL, PASSWORD).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }
    @Test void googleIsDisabledWithoutCredentials() throws Exception {
        mvc.perform(get("/api/v1/auth/providers")).andExpect(status().isOk()).andExpect(jsonPath("$.data.google").value(false));
    }
    @Test void frontendCorsPreflightAndValidationResponsesHaveCorsHeaders() throws Exception {
        mvc.perform(options("/api/v1/auth/register")
            .header("Origin", "http://localhost:3000")
            .header("Access-Control-Request-Method", "POST")
            .header("Access-Control-Request-Headers", "content-type"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"));
        mvc.perform(post("/api/v1/auth/register").header("Origin", "http://localhost:3000")
            .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"));
    }
    @Test void corsRejectsUnknownOrigins() throws Exception {
        mvc.perform(options("/api/v1/auth/login")
            .header("Origin", "https://untrusted.example")
            .header("Access-Control-Request-Method", "POST"))
            .andExpect(status().isForbidden())
            .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }
    @Test void googleRequiresVerifiedIdentityAndDoesNotLinkPasswordAccountByEmail() throws Exception {
        customer();
        assertThatThrownBy(() -> oauth.googleUser("subject", EMAIL, false, "Google user")).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> oauth.googleUser("subject", EMAIL, true, "Google user")).isInstanceOf(RuntimeException.class);
        assertThat(users.findByEmail(EMAIL).orElseThrow().getGoogleSubject()).isNull();
        User google = oauth.googleUser("google-subject", "google@example.lk", true, "Google user");
        assertThat(google.getPasswordHash()).isNull(); assertThat(google.getRole()).isEqualTo(Role.CUSTOMER);
        assertThat(oauth.googleUser("google-subject", "google@example.lk", true, "Google user").getId()).isEqualTo(google.getId());
        google.setActive(false); users.saveAndFlush(google);
        assertThatThrownBy(() -> oauth.googleUser("google-subject", "google@example.lk", true, "Google user")).isInstanceOf(RuntimeException.class);
    }
    ResultActions exchange(String code, String verifier) throws Exception {
        return mvc.perform(post("/api/v1/auth/oauth/exchange").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(Map.of("code", code, "verifier", verifier))));
    }
    @Test void oauthCodeIsBoundToBrowserAndSingleUse() throws Exception {
        User user = customer(); String verifier = "a".repeat(43);
        String code = oauth.createCode(user, OAuthService.challenge(verifier));
        exchange(code, "b".repeat(43)).andExpect(status().isUnauthorized());
        exchange(code, verifier).andExpect(status().isOk()).andExpect(jsonPath("$.data.user.id").value(user.getId().toString()));
        exchange(code, verifier).andExpect(status().isUnauthorized());
    }
    @Test void expiredAndInactiveOAuthExchangesAreRejected() throws Exception {
        User user = customer(); String verifier = "a".repeat(43); String expired = "x".repeat(43);
        codes.saveAndFlush(new OAuthCode(HexFormat.of().formatHex(OAuthService.digest(expired)), user.getId(), OAuthService.challenge(verifier), Instant.now().minusSeconds(1)));
        exchange(expired, verifier).andExpect(status().isUnauthorized());
        String code = oauth.createCode(user, OAuthService.challenge(verifier)); user.setActive(false); users.saveAndFlush(user);
        exchange(code, verifier).andExpect(status().isUnauthorized());
    }
    @Test void simultaneousExchangeHasOnlyOneWinner() throws Exception {
        User user = customer(); String verifier = "a".repeat(43); String code = oauth.createCode(user, OAuthService.challenge(verifier));
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            CountDownLatch start = new CountDownLatch(1);
            Callable<Boolean> attempt = () -> { start.await(); try { oauth.exchange(code, verifier); return true; } catch (RuntimeException expected) { return false; } };
            Future<Boolean> first = executor.submit(attempt); Future<Boolean> second = executor.submit(attempt); start.countDown();
            assertThat(List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS))).containsExactlyInAnyOrder(true, false);
        }
    }
}
