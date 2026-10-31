package com.swiftdrop.auth;

import com.fasterxml.jackson.databind.*;
import com.swiftdrop.auth.entity.*;
import com.swiftdrop.auth.repository.*;
import com.swiftdrop.auth.security.SessionCookies;
import com.swiftdrop.auth.service.BrowserSessionService;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class SessionIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired OAuthCodeRepository codes;
    @Autowired RefreshSessionRepository sessions;
    @Autowired RefreshTokenRepository tokens;
    @Autowired BrowserSessionService browserSessions;
    static final String EMAIL = "session-test@example.lk", PASSWORD = "Session@123!";
    @BeforeEach void setup() throws Exception {
        codes.deleteAll(); sessions.deleteAll(); users.deleteAll();
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(Map.of("name","Session test","email",EMAIL,"password",PASSWORD))))
            .andExpect(status().isCreated());
    }
    MockHttpServletResponse login() throws Exception {
        return mvc.perform(post("/api/v1/auth/login").header("Origin","http://localhost:3000")
            .header(SessionCookies.CSRF_HEADER,"1").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(Map.of("email",EMAIL,"password",PASSWORD))))
            .andExpect(status().isOk()).andReturn().getResponse();
    }
    String token(MockHttpServletResponse response) throws Exception { return json.readTree(response.getContentAsString()).path("data").path("token").asText(); }
    Cookie cookie(MockHttpServletResponse response) { return response.getCookie(SessionCookies.NAME); }
    ResultActions refresh(Cookie cookie) throws Exception {
        return mvc.perform(post("/api/v1/auth/refresh").header(SessionCookies.CSRF_HEADER,"1")
            .header("Origin","http://localhost:3000").cookie(cookie));
    }
    ResultActions me(String token) throws Exception { return mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+token)); }
    @Test void cookieIsHttpOnlyScopedAndHashOnlyIsStored() throws Exception {
        var response=login(); var cookie=cookie(response);
        assertThat(cookie).isNotNull(); assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getPath()).isEqualTo("/api/v1/auth"); assertThat(cookie.getMaxAge()).isPositive();
        assertThat(response.getHeaders("Set-Cookie").toString()).contains("SameSite=Lax");
        assertThat(response.getHeader("Access-Control-Allow-Origin")).isEqualTo("http://localhost:3000");
        assertThat(response.getHeader("Access-Control-Allow-Credentials")).isEqualTo("true");
        assertThat(response.getContentAsString()).doesNotContain(cookie.getValue(),"refreshToken");
        assertThat(tokens.findById(BrowserSessionService.hash(cookie.getValue()))).isPresent();
        assertThat(tokens.findById(cookie.getValue())).isEmpty();
        me(token(response)).andExpect(status().isOk());
    }
    @Test void refreshRotatesAndKeepsAbsoluteSessionExpiry() throws Exception {
        var first=login(); Instant expiry=sessions.findAll().getFirst().getExpiresAt();
        var second=refresh(cookie(first)).andExpect(status().isOk()).andReturn().getResponse();
        assertThat(cookie(second).getValue()).isNotEqualTo(cookie(first).getValue());
        assertThat(sessions.findAll().getFirst().getExpiresAt()).isEqualTo(expiry);
        assertThat(tokens.findById(BrowserSessionService.hash(cookie(first).getValue())).orElseThrow().isConsumed()).isTrue();
        me(token(second)).andExpect(status().isOk());
    }
    @Test void replayRevokesReplacementAndAccessTokens() throws Exception {
        var first=login(); var second=refresh(cookie(first)).andExpect(status().isOk()).andReturn().getResponse();
        refresh(cookie(first)).andExpect(status().isUnauthorized());
        assertThat(sessions.findAll().getFirst().isActive()).isFalse();
        refresh(cookie(second)).andExpect(status().isUnauthorized());
        me(token(first)).andExpect(status().isUnauthorized()); me(token(second)).andExpect(status().isUnauthorized());
    }
    @Test void logoutRevokesAndClearsCookieAndIsIdempotent() throws Exception {
        var login=login();
        for(int i=0;i<2;i++) {
            var response=mvc.perform(post("/api/v1/auth/logout").header(SessionCookies.CSRF_HEADER,"1").cookie(cookie(login)))
                .andExpect(status().isNoContent()).andReturn().getResponse();
            assertThat(cookie(response).getMaxAge()).isZero();
        }
        refresh(cookie(login)).andExpect(status().isUnauthorized()); me(token(login)).andExpect(status().isUnauthorized());
    }
    @Test void missingAndRandomCookiesCannotRefresh() throws Exception {
        mvc.perform(post("/api/v1/auth/refresh").header(SessionCookies.CSRF_HEADER,"1"))
            .andExpect(status().isUnauthorized());
        refresh(new Cookie(SessionCookies.NAME,"a".repeat(43))).andExpect(status().isUnauthorized());
    }
    @Test void expiredAndInactiveSessionsAreRejected() throws Exception {
        User user=users.findByEmail(EMAIL).orElseThrow();
        var expired=sessions.saveAndFlush(new RefreshSession(user.getId(),Instant.now().minusSeconds(1)));
        String raw="x".repeat(43); tokens.saveAndFlush(new RefreshToken(BrowserSessionService.hash(raw),expired.getId()));
        refresh(new Cookie(SessionCookies.NAME,raw)).andExpect(status().isUnauthorized());
        var login=login(); user.setActive(false);users.saveAndFlush(user);
        refresh(cookie(login)).andExpect(status().isUnauthorized()); me(token(login)).andExpect(status().isUnauthorized());
    }
    @Test void csrfHeaderAndOriginAreEnforcedBeforeCookieMutation() throws Exception {
        var login=login();
        mvc.perform(post("/api/v1/auth/refresh").cookie(cookie(login))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/logout").cookie(cookie(login))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/refresh").cookie(cookie(login)).header(SessionCookies.CSRF_HEADER,"1")
            .header("Origin","https://attacker.example")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/login").header("Origin","http://localhost:3000")
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("email",EMAIL,"password",PASSWORD))))
            .andExpect(status().isForbidden());
        refresh(cookie(login)).andExpect(status().isOk());
    }
    @Test void newLoginRevokesThePreviousBrowserSession() throws Exception {
        var first=login();
        mvc.perform(post("/api/v1/auth/login").cookie(cookie(first)).header(SessionCookies.CSRF_HEADER,"1")
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("email",EMAIL,"password",PASSWORD))))
            .andExpect(status().isOk());
        me(token(first)).andExpect(status().isUnauthorized());
    }
    @Test void concurrentRotationHasOneWinnerAndReplayRevokesFamily() throws Exception {
        var first=login();
        try(ExecutorService executor=Executors.newFixedThreadPool(2)) {
            CountDownLatch start=new CountDownLatch(1);
            Callable<Integer> attempt=()->{start.await();return refresh(cookie(first)).andReturn().getResponse().getStatus();};
            var a=executor.submit(attempt);var b=executor.submit(attempt);start.countDown();
            assertThat(List.of(a.get(10,TimeUnit.SECONDS),b.get(10,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,401);
        }
        assertThat(sessions.findAll().getFirst().isActive()).isFalse();
    }
    @Test void productionCookiesAreSecure() {
        var cookies=new SessionCookies(true);var response=new MockHttpServletResponse();cookies.clear(response);
        assertThat(response.getHeader("Set-Cookie")).contains("Secure","HttpOnly","SameSite=Lax","Max-Age=0");
    }
    @Test void credentialedSessionPreflightAllowsCsrfHeader() throws Exception {
        mvc.perform(options("/api/v1/auth/refresh").header("Origin","http://localhost:3000")
            .header("Access-Control-Request-Method","POST")
            .header("Access-Control-Request-Headers","content-type,x-swiftdrop-csrf"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Credentials","true"))
            .andExpect(header().string("Access-Control-Allow-Origin","http://localhost:3000"));
    }
    @Test void cleanupDeletesExpiredFamiliesAndTheirTokenHashesOnly() {
        var user=users.findByEmail(EMAIL).orElseThrow();
        var expired=sessions.saveAndFlush(new RefreshSession(user.getId(),Instant.now().minusSeconds(1)));
        var active=sessions.saveAndFlush(new RefreshSession(user.getId(),Instant.now().plusSeconds(300)));
        tokens.saveAndFlush(new RefreshToken("e".repeat(64),expired.getId()));
        tokens.saveAndFlush(new RefreshToken("a".repeat(64),active.getId()));
        browserSessions.removeExpiredSessions();
        assertThat(sessions.findById(expired.getId())).isEmpty();
        assertThat(tokens.findById("e".repeat(64))).isEmpty();
        assertThat(sessions.findById(active.getId())).isPresent();
        assertThat(tokens.findById("a".repeat(64))).isPresent();
    }
}
