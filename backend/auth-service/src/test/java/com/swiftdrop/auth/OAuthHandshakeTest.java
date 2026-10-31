package com.swiftdrop.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"app.google-client-id=test-client", "app.google-client-secret=test-secret"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OAuthHandshakeTest {
    @Autowired MockMvc mvc;
    @Test void startsGoogleWithStateNonceAndDatabaseBackedSession() throws Exception {
        var response = mvc.perform(get("/oauth2/authorization/google").param("challenge", "a".repeat(43)))
            .andExpect(status().is3xxRedirection()).andReturn().getResponse();
        assertThat(response.getRedirectedUrl()).startsWith("https://accounts.google.com/o/oauth2/v2/auth?")
            .contains("state=", "nonce=", "client_id=test-client", "openid", "redirect_uri=");
        assertThat(response.getCookie("SESSION")).isNotNull();
        assertThat(response.getCookie("SESSION").isHttpOnly()).isTrue();
    }
    @Test void callbackWithoutMatchingStateDoesNotAuthenticate() throws Exception {
        mvc.perform(get("/login/oauth2/code/google").param("code", "fake-provider-code").param("state", "forged-state"))
            .andExpect(status().is3xxRedirection())
            .andExpect(redirectedUrl("http://localhost:3000/login?error=google_auth_failed"));
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
    }
}
