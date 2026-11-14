package com.swiftdrop.merchant;

import com.swiftdrop.merchant.client.IdentityGateway;
import com.swiftdrop.merchant.exception.ApiFailure;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for {@code GET /api/v1/info}.
 *
 * <p>Verifies:
 * <ul>
 *   <li>Endpoint is publicly accessible (no Authorization header)</li>
 *   <li>Response contains expected service metadata fields</li>
 *   <li>No sensitive information is exposed</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(InfoEndpointTest.TestConfig.class)
class InfoEndpointTest {

    @TestConfiguration
    static class TestConfig {
        @Bean @Primary
        IdentityGateway fakeIdentity() {
            return new IdentityGateway() {
                public IdentityGateway.Caller validate(String token) {
                    throw new ApiFailure(401, "Invalid token");
                }
                public void grantMerchant(String token, java.util.UUID app, java.util.UUID user) {}
            };
        }
    }

    @Autowired MockMvc mvc;

    @Test
    void infoEndpointIsPublicAndReturnsExpectedFields() throws Exception {
        mvc.perform(get("/api/v1/info"))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.applicationName").value("merchant-service"))
            .andExpect(jsonPath("$.description").exists())
            .andExpect(jsonPath("$.version").exists())
            .andExpect(jsonPath("$.apiVersion").value("v1"))
            .andExpect(jsonPath("$.status").value("UP"))
            .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void infoEndpointDoesNotLeakSensitiveData() throws Exception {
        String body = mvc.perform(get("/api/v1/info"))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        org.assertj.core.api.Assertions.assertThat(body)
            .doesNotContain("jdbc:", "password", "secret", "token",
                    "apiKey", "host:", "127.0.0.1");
    }

    @Test
    void infoEndpointRejectsPost() throws Exception {
        mvc.perform(post("/api/v1/info"))
            .andExpect(status().isMethodNotAllowed());
    }
}
