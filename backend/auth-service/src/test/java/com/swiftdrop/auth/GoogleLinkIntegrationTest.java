package com.swiftdrop.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swiftdrop.auth.entity.*;
import com.swiftdrop.auth.exception.ApiException;
import com.swiftdrop.auth.repository.*;
import com.swiftdrop.auth.security.*;
import com.swiftdrop.auth.service.*;
import com.swiftdrop.auth.dto.IdentityDtos.ActivationRequest;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"app.google-client-id=test-client","app.google-client-secret=test-secret"})
@AutoConfigureMockMvc @ActiveProfiles("test")
class GoogleLinkIntegrationTest {
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired UserRepository users;
    @Autowired OAuthCodeRepository codes; @Autowired OAuthService oauth; @Autowired IdentityService identities;
    @Autowired BrowserSessionService sessions; @Autowired JwtService jwt; @Autowired JdbcTemplate db; @Autowired PasswordEncoder passwords;
    User user; static final String PASSWORD="LinkTest@123!", VERIFIER="v".repeat(43);
    @BeforeEach void setup(){codes.deleteAll();users.deleteAll();user=users.saveAndFlush(new User("Auto link","link-customer@example.lk",passwords.encode(PASSWORD),null));}
    @ParameterizedTest @EnumSource(Role.class)
    void verifiedGooglePreservesIdentityPasswordAndEveryRole(Role role)throws Exception{
        user.setRole(role);users.saveAndFlush(user);String hash=user.getPasswordHash();var old=sessions.start(user.getId(),null);
        User linked=oauth.googleUser("new-subject"," LINK-CUSTOMER@EXAMPLE.LK ",true,"Different Google name");
        assertThat(linked.getId()).isEqualTo(user.getId());assertThat(linked.getRole()).isEqualTo(role);assertThat(linked.getName()).isEqualTo(user.getName());assertThat(linked.getPasswordHash()).isEqualTo(hash);
        assertThat(oauth.googleUser("new-subject",user.getEmail(),true,"Google").getId()).isEqualTo(user.getId());
        assertThat(users.count()).isEqualTo(1);assertThat(db.queryForObject("select count(*) from auth.identity_audit where target_id=? and action='GOOGLE_AUTO_LINKED'",Integer.class,user.getId())).isEqualTo(1);
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+old.login().token())).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/refresh").header(SessionCookies.CSRF_HEADER,"1").header("Origin","http://localhost:3000").cookie(new jakarta.servlet.http.Cookie(SessionCookies.NAME,old.refreshToken()))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("email",user.getEmail(),"password",PASSWORD))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.user.id").value(user.getId().toString())).andExpect(jsonPath("$.data.user.role").value(role.name()));
    }
    @Test void unverifiedGoogleClaimsNeverAttachOrCreate(){
        assertThatThrownBy(()->oauth.googleUser("new",user.getEmail(),false,"Name")).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->oauth.googleUser("new","new@example.lk",null,"Name")).isInstanceOf(ApiException.class);
        assertThat(users.count()).isEqualTo(1);assertThat(users.findById(user.getId()).orElseThrow().getGoogleSubject()).isNull();
    }
    @Test void pendingActivationCannotBeBypassedAndOriginalInvitationStillWorks(){
        user.setPasswordHash(null);user.setRole(Role.COURIER);users.saveAndFlush(user);
        String code=identities.issueAction(user.getId(),"ACTIVATION",null,null,Instant.now().plusSeconds(300));
        assertThatThrownBy(()->oauth.googleUser("new",user.getEmail(),true,"Name")).isInstanceOf(OAuthService.ActivationRequired.class);
        assertThat(users.count()).isEqualTo(1);assertThat(users.findById(user.getId()).orElseThrow().getGoogleSubject()).isNull();
        identities.activate(new ActivationRequest(code,PASSWORD));
        assertThat(oauth.googleUser("new",user.getEmail(),true,"Name").getRole()).isEqualTo(Role.COURIER);
    }
    @Test void disabledLinkedAndUnlinkedAccountsRemainDisabled(){
        user.setActive(false);users.saveAndFlush(user);assertThatThrownBy(()->oauth.googleUser("new",user.getEmail(),true,"Name")).isInstanceOf(ApiException.class);
        user.setGoogleSubject("already-linked");users.saveAndFlush(user);assertThatThrownBy(()->oauth.googleUser("already-linked",user.getEmail(),true,"Name")).isInstanceOf(ApiException.class);
    }
    @Test void newGoogleIdentityCreatesCustomerWithoutPassword(){
        User created=oauth.googleUser("new","new@example.lk",true,"New customer");
        assertThat(created.getId()).isNotEqualTo(user.getId());assertThat(created.getRole()).isEqualTo(Role.CUSTOMER);assertThat(created.getPasswordHash()).isNull();
        assertThat(oauth.googleUser("new","new@example.lk",true,"Changed").getId()).isEqualTo(created.getId());
    }
    @Test void cannotOverwriteAnExistingGoogleAssociationAndConflictAuditSurvivesRollback(){
        user.setGoogleSubject("original");users.saveAndFlush(user);
        assertThatThrownBy(()->oauth.googleUser("different",user.getEmail(),true,"Name")).isInstanceOf(ApiException.class);
        assertThat(users.findById(user.getId()).orElseThrow().getGoogleSubject()).isEqualTo("original");
        assertThat(db.queryForObject("select count(*) from auth.identity_audit where target_id=? and action='GOOGLE_LINK_CONFLICT'",Integer.class,user.getId())).isEqualTo(1);
    }
    @Test void aSubjectOwnedByAnotherIdentityCannotMergeAccounts(){
        User other=new User("Other","other@example.lk",null,null);other.setGoogleSubject("taken");users.saveAndFlush(other);
        assertThatThrownBy(()->oauth.googleUser("taken",user.getEmail(),true,"Name")).isInstanceOf(ApiException.class);
        assertThat(users.findByGoogleSubject("taken").orElseThrow().getId()).isEqualTo(other.getId());assertThat(users.findById(user.getId()).orElseThrow().getGoogleSubject()).isNull();
    }
    @Test void anExistingSubjectRemainsTheKeyWhenItsProviderEmailChanges(){
        user.setGoogleSubject("original");users.saveAndFlush(user);
        assertThat(oauth.googleUser("original","changed@example.lk",true,"Name").getId()).isEqualTo(user.getId());
        assertThat(users.findById(user.getId()).orElseThrow().getEmail()).isEqualTo(user.getEmail());
    }
    private Set<UUID> concurrent(String email)throws Exception{
        try(var pool=Executors.newFixedThreadPool(3)){
            var start=new CountDownLatch(1);List<Future<UUID>> futures=new ArrayList<>();
            for(int i=0;i<3;i++)futures.add(pool.submit(()->{start.await();return oauth.googleUser("concurrent-subject",email,true,"Name").getId();}));
            start.countDown();Set<UUID> ids=new HashSet<>();for(var future:futures)ids.add(future.get(15,TimeUnit.SECONDS));return ids;
        }
    }
    @Test void concurrentFirstLoginsToPasswordAccountLinkOnce()throws Exception{
        assertThat(concurrent(user.getEmail())).containsExactly(user.getId());
        assertThat(users.findById(user.getId()).orElseThrow().getAuthVersion()).isEqualTo(1);
    }
    @Test void concurrentNewGoogleLoginsDoNotCreateDuplicateIdentities()throws Exception{
        assertThat(concurrent("concurrent@example.lk")).hasSize(1);assertThat(users.count()).isEqualTo(2);
    }
    @Test void oldManualLinkEndpointIsRemovedAndAccountViewRemainsSafe()throws Exception{
        String token=jwt.issue(user).token();
        mvc.perform(post("/api/v1/auth/google/link").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/auth/account").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.data.googleLinked").value(false)).andExpect(jsonPath("$.data.passwordHash").doesNotExist());
    }
}
