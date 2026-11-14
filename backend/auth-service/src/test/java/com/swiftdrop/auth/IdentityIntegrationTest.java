package com.swiftdrop.auth;

import com.fasterxml.jackson.databind.*;
import com.swiftdrop.auth.dto.IdentityDtos.*;
import com.swiftdrop.auth.entity.*;
import com.swiftdrop.auth.repository.*;
import com.swiftdrop.auth.security.*;
import com.swiftdrop.auth.service.*;
import java.net.URI;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class IdentityIntegrationTest {
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired UserRepository users;
    @Autowired OAuthCodeRepository codes; @Autowired JdbcTemplate db; @Autowired IdentityService identities;
    @Autowired PasswordEncoder passwords; @Autowired JwtService jwt; @Autowired JwtDecoder decoder;
    @Autowired BrowserSessionService browserSessions;
    @Autowired org.springframework.context.ApplicationContext context;
    static final String PASSWORD="IsolatedTest@123!";
    User admin; String adminToken;
    @BeforeEach void setup(){
        codes.deleteAll();users.deleteAll();db.update("delete from auth.identity_audit");
        db.update("update auth.identity_admin_guard set bootstrapped=false where id=1");
        var profile=identities.bootstrap("Admin","identity-admin@example.lk",PASSWORD);
        admin=users.findById(profile.id()).orElseThrow();adminToken=jwt.issue(admin).token();
    }
    User fixture(Role role){User u=new User("Test "+role,role.name().toLowerCase()+"@example.lk",passwords.encode(PASSWORD),null);u.setRole(role);return users.saveAndFlush(u);}
    ResultActions postAs(String path,String token,Object body)throws Exception{
        var request=post("/api/v1/auth"+path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body));
        if(token!=null)request.header("Authorization","Bearer "+token);
        return mvc.perform(request);
    }
    JsonNode data(ResultActions action)throws Exception{return json.readTree(action.andReturn().getResponse().getContentAsString()).path("data");}
    Map<String,Object> provision(Role role){return Map.of("name","Provisioned test","email","provisioned@example.lk","role",role.name(),"active",true);}
    @ParameterizedTest @EnumSource(Role.class)
    void allRolesLoginHaveSignedRoleAndRestoreAndLogout(Role role)throws Exception{
        User user=role==Role.ADMIN?admin:fixture(role);
        var login=mvc.perform(post("/api/v1/auth/login").header("Origin","http://localhost:3000").header(SessionCookies.CSRF_HEADER,"1")
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("email",user.getEmail(),"password",PASSWORD))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.user.role").value(role.name())).andReturn().getResponse();
        String access=json.readTree(login.getContentAsString()).path("data").path("token").asText();
        assertThat(decoder.decode(access).getClaimAsString("role")).isEqualTo(role.name());
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+access)).andExpect(status().isOk()).andExpect(jsonPath("$.data.role").value(role.name()));
        var rotated=mvc.perform(post("/api/v1/auth/refresh").header(SessionCookies.CSRF_HEADER,"1").cookie(login.getCookie(SessionCookies.NAME)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.user.role").value(role.name())).andReturn().getResponse();
        mvc.perform(post("/api/v1/auth/logout").header(SessionCookies.CSRF_HEADER,"1").cookie(rotated.getCookie(SessionCookies.NAME))).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+access)).andExpect(status().isUnauthorized());
    }
    @ParameterizedTest @EnumSource(value=Role.class,names={"MERCHANT","COURIER","DISPATCHER"})
    void adminProvisionsOneUseActivationAndPasswordsAreNeverReturned(Role role)throws Exception{
        var result=postAs("/admin/users",adminToken,provision(role)).andExpect(status().isCreated());
        var node=data(result);String code=URI.create(node.path("activationUrl").asText()).getFragment().substring(5);
        assertThat(db.queryForObject("select token_hash from auth.identity_actions",String.class)).isEqualTo(BrowserSessionService.hash(code));
        assertThat(result.andReturn().getResponse().getContentAsString()).doesNotContain("passwordHash","refreshToken");
        var body=Map.of("code",code,"password",PASSWORD);
        postAs("/activate",null,body).andExpect(status().isNoContent());
        postAs("/activate",null,body).andExpect(status().isUnauthorized());
        User user=users.findByEmail("provisioned@example.lk").orElseThrow();assertThat(passwords.matches(PASSWORD,user.getPasswordHash())).isTrue();
        postAs("/login",null,Map.of("email",user.getEmail(),"password",PASSWORD)).andExpect(status().isOk()).andExpect(jsonPath("$.data.role").value(role.name()));
        postAs("/admin/users",adminToken,provision(role)).andExpect(status().isConflict());
        mvc.perform(get("/api/v1/auth/admin/users/"+user.getId()+"/audit").header("Authorization","Bearer "+adminToken))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].actorId").exists());
    }
    @ParameterizedTest @EnumSource(value=Role.class,names={"CUSTOMER","MERCHANT","COURIER","DISPATCHER"})
    void nonAdminsCannotReadOrMutateUsers(Role role)throws Exception{
        String token=jwt.issue(fixture(role)).token();
        mvc.perform(get("/api/v1/auth/admin/users").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        postAs("/admin/users",token,provision(Role.COURIER)).andExpect(status().isForbidden());
        postAs("/admin/users/"+admin.getId()+"/status",token,Map.of("active",false)).andExpect(status().isForbidden());
        postAs("/admin/users",token,provision(Role.ADMIN)).andExpect(status().isForbidden());
    }
    @Test void publicRequestsAndMassAssignmentCannotProvision()throws Exception{
        postAs("/admin/users",null,provision(Role.COURIER)).andExpect(status().isUnauthorized());
        postAs("/admin/users",adminToken,provision(Role.ADMIN)).andExpect(status().isForbidden());
        var mass=new HashMap<>(provision(Role.COURIER));mass.put("password",PASSWORD);
        postAs("/admin/users",adminToken,mass).andExpect(status().isBadRequest());
        mass.remove("password");mass.put("email","invalid");postAs("/admin/users",adminToken,mass).andExpect(status().isBadRequest());
    }
    @Test void selfChangesAndAllAdminChangesAreForbidden()throws Exception{
        postAs("/admin/users/"+admin.getId()+"/status",adminToken,Map.of("active",false)).andExpect(status().isForbidden());
        postAs("/admin/users/"+admin.getId()+"/role",adminToken,Map.of("role","COURIER")).andExpect(status().isForbidden());
        var other=fixture(Role.ADMIN);
        postAs("/admin/users/"+other.getId()+"/status",adminToken,Map.of("active",false)).andExpect(status().isForbidden());
        assertThat(users.findById(admin.getId()).orElseThrow().isActive()).isTrue();
    }
    @Test void roleChangeAndDeactivationRevokeSessionAndLegacyAccess()throws Exception{
        User user=fixture(Role.COURIER);String legacy=jwt.issue(user).token();
        var browser=browserSessions.start(user.getId(),null);
        postAs("/login",null,Map.of("email",user.getEmail(),"password",PASSWORD)).andExpect(status().isOk());
        postAs("/admin/users/"+user.getId()+"/role",adminToken,Map.of("role","DISPATCHER")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+legacy)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+browser.login().token())).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/refresh").header(SessionCookies.CSRF_HEADER,"1")
            .cookie(new jakarta.servlet.http.Cookie(SessionCookies.NAME,browser.refreshToken()))).andExpect(status().isUnauthorized());
        String fresh=data(postAs("/login",null,Map.of("email",user.getEmail(),"password",PASSWORD)).andExpect(status().isOk())).path("token").asText();
        mvc.perform(get("/api/v1/auth/admin/me").header("Authorization","Bearer "+fresh)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/auth/admin/users").header("Authorization","Bearer "+fresh)).andExpect(status().isForbidden());
        postAs("/admin/users/"+user.getId()+"/status",adminToken,Map.of("active",false)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+fresh)).andExpect(status().isUnauthorized());
        postAs("/login",null,Map.of("email",user.getEmail(),"password",PASSWORD)).andExpect(status().isUnauthorized());
        postAs("/admin/users/"+user.getId()+"/status",adminToken,Map.of("active",true)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+fresh)).andExpect(status().isUnauthorized());
    }
    @Test void activationExpiryInactiveAndReissueAreEnforced()throws Exception{
        var first=data(postAs("/admin/users",adminToken,provision(Role.COURIER)).andExpect(status().isCreated()));
        String id=first.path("user").path("id").asText();String old=URI.create(first.path("activationUrl").asText()).getFragment().substring(5);
        var second=data(postAs("/admin/users/"+id+"/activation",adminToken,Map.of()).andExpect(status().isOk()));
        String latest=URI.create(second.path("activationUrl").asText()).getFragment().substring(5);
        postAs("/activate",null,Map.of("code",old,"password",PASSWORD)).andExpect(status().isUnauthorized());
        postAs("/activate",null,Map.of("code",latest,"password","short")).andExpect(status().isBadRequest());
        db.update("update auth.identity_actions set expires_at=?",Timestamp.from(Instant.now().minusSeconds(1)));
        postAs("/activate",null,Map.of("code",latest,"password",PASSWORD)).andExpect(status().isUnauthorized());
        postAs("/admin/users/"+id+"/status",adminToken,Map.of("active",false)).andExpect(status().isOk());
        String inactive=URI.create(data(postAs("/admin/users/"+id+"/activation",adminToken,Map.of()).andExpect(status().isOk())).path("activationUrl").asText()).getFragment().substring(5);
        postAs("/activate",null,Map.of("code",inactive,"password",PASSWORD)).andExpect(status().isUnauthorized());
    }
    @Test void bootstrapCannotRepeatPromoteExistingOrReturnAfterAdminRemoval(){
        assertThatThrownBy(()->identities.bootstrap("Other","other@example.lk",PASSWORD)).isInstanceOf(RuntimeException.class);
        users.deleteAll();
        assertThatThrownBy(()->identities.bootstrap("Other","other@example.lk",PASSWORD)).isInstanceOf(RuntimeException.class);
        db.update("update auth.identity_admin_guard set bootstrapped=false where id=1");
        User customer=fixture(Role.CUSTOMER);
        assertThatThrownBy(()->identities.bootstrap("Other",customer.getEmail(),PASSWORD)).isInstanceOf(RuntimeException.class);
        assertThat(users.findById(customer.getId()).orElseThrow().getRole()).isEqualTo(Role.CUSTOMER);
    }
    @Test void concurrentBootstrapCreatesExactlyOneAdministrator()throws Exception{
        users.deleteAll();db.update("update auth.identity_admin_guard set bootstrapped=false where id=1");
        try(var executor=Executors.newFixedThreadPool(2)){
            var start=new CountDownLatch(1);
            Callable<Boolean> attempt=()->{start.await();try{identities.bootstrap("First","first@example.lk",PASSWORD);return true;}catch(RuntimeException e){return false;}};
            var a=executor.submit(attempt);var b=executor.submit(attempt);start.countDown();
            assertThat(List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }
        assertThat(users.count()).isEqualTo(1);
    }
    @Test void paginatedSearchAndAuditAreSafe()throws Exception{
        mvc.perform(get("/api/v1/auth/admin/users").param("search","identity-admin").header("Authorization","Bearer "+adminToken))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(1)).andExpect(jsonPath("$.data.users[0].passwordHash").doesNotExist());
        mvc.perform(get("/api/v1/auth/admin/users").param("page","-1").header("Authorization","Bearer "+adminToken)).andExpect(status().isBadRequest());
    }
    @Test void concurrentRefreshesForDifferentRolesStayIsolated()throws Exception{
        var merchant=browserSessions.start(fixture(Role.MERCHANT).getId(),null);
        var courier=browserSessions.start(fixture(Role.COURIER).getId(),null);
        try(var executor=Executors.newFixedThreadPool(2)){
            var start=new CountDownLatch(1);
            var a=executor.submit(()->{start.await();return browserSessions.rotate(merchant.refreshToken());});
            var b=executor.submit(()->{start.await();return browserSessions.rotate(courier.refreshToken());});start.countDown();
            assertThat(a.get(10,TimeUnit.SECONDS).login().role()).isEqualTo(Role.MERCHANT);
            assertThat(b.get(10,TimeUnit.SECONDS).login().role()).isEqualTo(Role.COURIER);
        }
    }
    @Test void bootstrapIsDisabledAndSensitiveDtosAreRedactedByDefault(){
        assertThat(context.getBeansOfType(com.swiftdrop.auth.config.AdminBootstrap.class)).isEmpty();
        assertThat(new PasswordRequest(PASSWORD).toString()).doesNotContain(PASSWORD);
        assertThat(new ActivationRequest("sensitive-code",PASSWORD).toString()).doesNotContain(PASSWORD,"sensitive-code");
        var result=jwt.issue(admin);
        assertThat(com.swiftdrop.auth.dto.AuthDtos.ApiResponse.ok(result).toString()).doesNotContain(result.token());
    }
}
