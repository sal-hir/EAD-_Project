package com.swiftdrop.auth;

import com.swiftdrop.auth.entity.*;
import com.swiftdrop.auth.repository.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.merchant-service-token=test-only-machine-identity-service-secret")
@AutoConfigureMockMvc @ActiveProfiles("test")
class MerchantApiIdentityTest {
    static final String KEY = "test-only-machine-identity-service-secret";
    @Autowired MockMvc mvc; @Autowired UserRepository users;
    UUID id;
    @BeforeEach void setup() {
        var user = new User("API merchant", "api-" + UUID.randomUUID() + "@example.test", null, null);
        user.setRole(Role.MERCHANT); id = users.saveAndFlush(user).getId();
    }
    @Test void serviceKeyIsRequiredAndOnlyMinimalCurrentIdentityIsReturned() throws Exception {
        String body = "{\"userId\":\"" + id + "\"}";
        mvc.perform(post("/api/v1/auth/internal/merchant-api/identity").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/internal/merchant-api/identity").header("X-SwiftDrop-Service-Key", "wrong")
            .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/internal/merchant-api/identity").header("X-SwiftDrop-Service-Key", KEY)
            .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.id").value(id.toString())).andExpect(jsonPath("$.data.active").value(true))
            .andExpect(jsonPath("$.data.role").value("MERCHANT")).andExpect(jsonPath("$.data.email").doesNotExist())
            .andExpect(jsonPath("$.data.passwordHash").doesNotExist()).andExpect(header().string("Cache-Control", "no-store"));
    }
    @Test void deactivationAndRoleChangeAreVisibleWithoutCachedIdentity() throws Exception {
        var user = users.findById(id).orElseThrow(); user.setActive(false); user.setRole(Role.CUSTOMER); users.saveAndFlush(user);
        mvc.perform(post("/api/v1/auth/internal/merchant-api/identity").header("X-SwiftDrop-Service-Key", KEY)
            .contentType(MediaType.APPLICATION_JSON).content("{\"userId\":\"" + id + "\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.active").value(false))
            .andExpect(jsonPath("$.data.role").value("CUSTOMER"));
    }
    @Test void unknownIdentitiesAndInjectedFieldsAreRejected() throws Exception {
        mvc.perform(post("/api/v1/auth/internal/merchant-api/identity").header("X-SwiftDrop-Service-Key", KEY)
            .contentType(MediaType.APPLICATION_JSON).content("{\"userId\":\"" + UUID.randomUUID() + "\"}"))
            .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/auth/internal/merchant-api/identity").header("X-SwiftDrop-Service-Key", KEY)
            .contentType(MediaType.APPLICATION_JSON).content("{\"userId\":\"" + id + "\",\"role\":\"ADMIN\"}"))
            .andExpect(status().isBadRequest());
    }
}
