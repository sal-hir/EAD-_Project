package com.swiftdrop.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import com.swiftdrop.auth.repository.UserRepository;
import com.swiftdrop.auth.security.SessionCookies;
import com.swiftdrop.auth.service.OAuthService;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.*;
import org.springframework.context.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.client.registration.*;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real OIDC authorization-code, nonce and signature validation against a local provider. */
@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
@Import(GoogleOidcIntegrationTest.Provider.class)
class GoogleOidcIntegrationTest {
    static final ObjectMapper JSON = new ObjectMapper();
    static HttpServer provider;
    static RSAKey key;
    static String issuer, nonce;
    static boolean wrongNonce;
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;

    @TestConfiguration
    static class Provider {
        @Bean @Primary ClientRegistrationRepository testGoogle() throws Exception {
            key = new RSAKeyGenerator(2048).keyID("test-key").generate();
            provider = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            issuer = "http://127.0.0.1:" + provider.getAddress().getPort();
            provider.createContext("/jwks", exchange -> {
                byte[] body = new JWKSet(key.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length); exchange.getResponseBody().write(body); exchange.close();
            });
            provider.createContext("/token", exchange -> {
                try {
                    String request = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                    if (!request.contains("code=provider-code")) throw new IllegalArgumentException("Unexpected code");
                    var claims = new JWTClaimsSet.Builder().issuer(issuer).audience("test-client")
                        .subject("mock-google-subject").issueTime(Date.from(Instant.now()))
                        .expirationTime(Date.from(Instant.now().plusSeconds(300)))
                        .claim("nonce", wrongNonce ? "invalid-nonce" : nonce)
                        .claim("email", "oidc-customer@example.lk").claim("email_verified", true)
                        .claim("name", "Google customer").build();
                    var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(), claims);
                    jwt.sign(new RSASSASigner(key));
                    byte[] body = JSON.writeValueAsBytes(Map.of("access_token", "test-provider-access", "token_type", "Bearer",
                        "expires_in", 300, "scope", "openid", "id_token", jwt.serialize()));
                    exchange.getResponseHeaders().set("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, body.length); exchange.getResponseBody().write(body);
                } catch (Exception e) { exchange.sendResponseHeaders(500, -1); }
                finally { exchange.close(); }
            });
            provider.start();
            return new InMemoryClientRegistrationRepository(ClientRegistration.withRegistrationId("google")
                .clientId("test-client").clientSecret("test-provider-secret")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("http://localhost:4000/login/oauth2/code/google").scope("openid")
                .authorizationUri(issuer + "/authorize").tokenUri(issuer + "/token")
                .jwkSetUri(issuer + "/jwks").issuerUri(issuer).userNameAttributeName("sub").build());
        }
    }
    @AfterAll static void stopProvider() { if (provider != null) provider.stop(0); }
    Map<String,String> query(String url) {
        Map<String,String> result = new HashMap<>();
        for (String part : URI.create(url).getRawQuery().split("&")) {
            String[] pair = part.split("=", 2);
            result.put(pair[0], URLDecoder.decode(pair[1], StandardCharsets.UTF_8));
        }
        return result;
    }
    @Test void completeSignedOidcLoginExchangeRefreshAndReturningCustomer() throws Exception {
        wrongNonce = false;
        for (int attempt = 0; attempt < 2; attempt++) {
            String verifier = "v".repeat(43);
            var start = mvc.perform(get("/oauth2/authorization/google").param("challenge", OAuthService.challenge(verifier)))
                .andExpect(status().is3xxRedirection()).andReturn().getResponse();
            var params = query(start.getRedirectedUrl()); nonce = params.get("nonce");
            var callback = mvc.perform(get("/login/oauth2/code/google").cookie(start.getCookie("SESSION"))
                .param("state", params.get("state")).param("code", "provider-code"))
                .andExpect(status().is3xxRedirection()).andReturn().getResponse();
            assertThat(callback.getRedirectedUrl()).startsWith("http://localhost:3000/auth/callback#code=")
                .doesNotContain("access_token", "refresh_token", "id_token");
            String code = URI.create(callback.getRedirectedUrl()).getFragment().substring("code=".length());
            byte[] body = JSON.writeValueAsBytes(Map.of("code", code, "verifier", verifier));
            var login = mvc.perform(post("/api/v1/auth/oauth/exchange").header(SessionCookies.CSRF_HEADER,"1")
                .header("Origin","http://localhost:3000").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.user.role").value("CUSTOMER"))
                .andReturn().getResponse();
            assertThat(login.getCookie(SessionCookies.NAME).isHttpOnly()).isTrue();
            String token = JSON.readTree(login.getContentAsString()).path("data").path("token").asText();
            mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer " + token)).andExpect(status().isOk());
            mvc.perform(post("/api/v1/auth/refresh").header(SessionCookies.CSRF_HEADER,"1").cookie(login.getCookie(SessionCookies.NAME)))
                .andExpect(status().isOk());
            mvc.perform(post("/api/v1/auth/oauth/exchange").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
        }
        assertThat(users.findByEmail("oidc-customer@example.lk")).isPresent();
    }
    @Test void rejectsIncorrectProviderNonce() throws Exception {
        wrongNonce = true;
        var start = mvc.perform(get("/oauth2/authorization/google").param("challenge","a".repeat(43)))
            .andReturn().getResponse();
        var params = query(start.getRedirectedUrl()); nonce = params.get("nonce");
        mvc.perform(get("/login/oauth2/code/google").cookie(start.getCookie("SESSION"))
            .param("state",params.get("state")).param("code","provider-code"))
            .andExpect(redirectedUrl("http://localhost:3000/login?error=google_auth_failed"));
    }
}
