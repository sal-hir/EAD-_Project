package com.swiftdrop.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swiftdrop.auth.entity.*;
import com.swiftdrop.auth.repository.*;
import com.swiftdrop.auth.security.*;
import com.swiftdrop.auth.service.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="app.merchant-service-token=test-only-internal-merchant-secret-never-deploy")
@AutoConfigureMockMvc @ActiveProfiles("test")
class MerchantRoleIntegrationTest {
    static final String KEY="test-only-internal-merchant-secret-never-deploy";
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired UserRepository users;@Autowired OAuthCodeRepository codes;
    @Autowired JwtService jwt;@Autowired BrowserSessionService sessions;@Autowired JdbcTemplate db;
    User admin,customer;UUID application;
    User fixture(String email,Role role){User u=new User("Grant test",email,null,null);u.setRole(role);return users.saveAndFlush(u);}
    @BeforeEach void setup(){codes.deleteAll();users.deleteAll();admin=fixture("grant-admin@example.lk",Role.ADMIN);customer=fixture("grant-customer@example.lk",Role.CUSTOMER);application=UUID.randomUUID();}
    ResultActions grant(User caller,String key,UUID target,Object body)throws Exception{
        var request=post("/api/v1/auth/internal/merchant-approvals/"+application).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body));
        if(caller!=null)request.header("Authorization","Bearer "+jwt.issue(caller).token());if(key!=null)request.header("X-SwiftDrop-Service-Key",key);
        return mvc.perform(request);
    }
    @Test void bothAdminBearerAndServiceCredentialAreRequired()throws Exception{
        grant(null,KEY,customer.getId(),Map.of("userId",customer.getId())).andExpect(status().isUnauthorized());
        grant(admin,null,customer.getId(),Map.of("userId",customer.getId())).andExpect(status().isForbidden());
        grant(admin,"wrong",customer.getId(),Map.of("userId",customer.getId())).andExpect(status().isForbidden());
        assertThat(users.findById(customer.getId()).orElseThrow().getRole()).isEqualTo(Role.CUSTOMER);
    }
    @ParameterizedTest @EnumSource(value=Role.class,names={"CUSTOMER","MERCHANT","COURIER","DISPATCHER"})
    void nonAdminsCannotPromoteEvenWithServiceKey(Role role)throws Exception{
        var caller=fixture(role.name().toLowerCase()+"@grant.example",role);
        grant(caller,KEY,customer.getId(),Map.of("userId",customer.getId())).andExpect(status().isForbidden());
    }
    @Test void promotionIsIdempotentAndRevokesOldSessions()throws Exception{
        var browser=sessions.start(customer.getId(),null);
        grant(admin,KEY,customer.getId(),Map.of("userId",customer.getId())).andExpect(status().isOk()).andExpect(jsonPath("$.data.role").value("MERCHANT"));
        var first=users.findById(customer.getId()).orElseThrow();int version=first.getAuthVersion();
        grant(admin,KEY,customer.getId(),Map.of("userId",customer.getId())).andExpect(status().isOk());
        assertThat(users.findById(customer.getId()).orElseThrow().getAuthVersion()).isEqualTo(version);
        assertThat(db.queryForObject("select count(*) from auth.merchant_role_grants where application_id=?",Integer.class,application)).isEqualTo(1);
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+browser.login().token())).andExpect(status().isUnauthorized());
        assertThatThrownBy(()->sessions.rotate(browser.refreshToken())).isInstanceOf(RuntimeException.class);
    }
    @Test void arbitraryRolesIdentityReuseAndPrivilegedTargetsAreRejected()throws Exception{
        grant(admin,KEY,customer.getId(),Map.of("userId",customer.getId(),"role","ADMIN")).andExpect(status().isBadRequest());
        grant(admin,KEY,admin.getId(),Map.of("userId",admin.getId())).andExpect(status().isConflict());
        grant(admin,KEY,customer.getId(),Map.of("userId",customer.getId())).andExpect(status().isOk());
        var other=fixture("other-grant@example.lk",Role.CUSTOMER);
        grant(admin,KEY,other.getId(),Map.of("userId",other.getId())).andExpect(status().isConflict());
        var downgraded=users.findById(customer.getId()).orElseThrow();downgraded.setRole(Role.CUSTOMER);users.saveAndFlush(downgraded);
        grant(admin,KEY,customer.getId(),Map.of("userId",customer.getId())).andExpect(status().isConflict());
    }
    @Test void existingMerchantRequiresNoDuplicateIdentityAndInactiveCannotPromote()throws Exception{
        customer.setRole(Role.MERCHANT);users.saveAndFlush(customer);
        grant(admin,KEY,customer.getId(),Map.of("userId",customer.getId())).andExpect(status().isOk());assertThat(users.count()).isEqualTo(2);
        application=UUID.randomUUID();customer.setActive(false);users.saveAndFlush(customer);
        grant(admin,KEY,customer.getId(),Map.of("userId",customer.getId())).andExpect(status().isConflict());
    }
}
