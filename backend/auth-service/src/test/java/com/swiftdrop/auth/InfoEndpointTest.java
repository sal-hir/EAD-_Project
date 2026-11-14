package com.swiftdrop.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
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
class InfoEndpointTest {

    @Autowired MockMvc mvc;

    @Test
    void infoEndpointIsPublicAndReturnsExpectedFields() throws Exception {
        mvc.perform(get("/api/v1/info"))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.applicationName").value("auth-service"))
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

        // Must not contain any database URLs, secrets, or internal paths
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
