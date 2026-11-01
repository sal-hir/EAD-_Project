package com.swiftdrop.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swiftdrop.auth.entity.*;
import com.swiftdrop.auth.exception.ApiException;
import com.swiftdrop.auth.repository.*;
import com.swiftdrop.auth.security.*;
import com.swiftdrop.auth.service.*;
import java.net.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
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
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired UserRepository users;
    @Autowired OAuthCodeRepository codes;@Autowired OAuthService oauth;@Autowired BrowserSessionService sessions;
    @Autowired JwtService jwt;@Autowired JdbcTemplate db;@Autowired PasswordEncoder passwords;
    User user;BrowserSessionService.SessionResult browser;
    static final String PASSWORD="LinkTest@123!",VERIFIER="v".repeat(43);
    @BeforeEach void setup(){
        codes.deleteAll();users.deleteAll();
        user=new User("Link test","link-customer@example.lk",passwords.encode(PASSWORD),null);user.setRole(Role.COURIER);users.saveAndFlush(user);
        browser=sessions.start(user.getId(),null);
    }
    String ticket()throws Exception{
        var response=mvc.perform(post("/api/v1/auth/google/link").header("Authorization","Bearer "+browser.login().token()).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(Map.of("password",PASSWORD,"challenge",OAuthService.challenge(VERIFIER)))))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andReturn().getResponse();
        String path=json.readTree(response.getContentAsString()).path("data").path("authorizationPath").asText();
        return Arrays.stream(URI.create(path).getQuery().split("&")).filter(x->x.startsWith("link=")).findFirst().orElseThrow().substring(5);
    }
    @Test void reauthenticationAndActiveBrowserSessionAreRequired()throws Exception{
        for(String token:List.of(browser.login().token(),jwt.issue(user).token())){
            mvc.perform(post("/api/v1/auth/google/link").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("password","incorrect","challenge",OAuthService.challenge(VERIFIER)))))
                .andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/v1/auth/google/link").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/account").header("Authorization","Bearer "+browser.login().token()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.googleLinked").value(false))
            .andExpect(jsonPath("$.data.passwordEnabled").value(true)).andExpect(jsonPath("$.data.passwordHash").doesNotExist());
    }
    @Test void collisionStaysBlockedUntilExplicitPasswordAndGoogleProof()throws Exception{
        assertThatThrownBy(()->oauth.googleUser("new-subject",user.getEmail(),true,"Google")).isInstanceOf(ApiException.class);
        var action=oauth.beginLink(ticket(),OAuthService.challenge(VERIFIER));
        User linked=oauth.completeLink(action.userId(),action.sessionId(),"new-subject",user.getEmail(),true);
        assertThat(linked.getId()).isEqualTo(user.getId());assertThat(linked.getRole()).isEqualTo(Role.COURIER);
        assertThat(oauth.googleUser("new-subject",user.getEmail(),true,"Google").getId()).isEqualTo(user.getId());
        assertThat(db.queryForObject("select count(*) from auth.identity_audit where target_id=? and action='GOOGLE_LINKED'",Integer.class,user.getId())).isEqualTo(1);
    }
    @Test void wrongChallengeExpiryReplayAndCancellationLeaveIdentityUnchanged()throws Exception{
        String raw=ticket();
        assertThatThrownBy(()->oauth.beginLink(raw,"a".repeat(43))).isInstanceOf(ApiException.class);
        oauth.beginLink(raw,OAuthService.challenge(VERIFIER));
        assertThatThrownBy(()->oauth.beginLink(raw,OAuthService.challenge(VERIFIER))).isInstanceOf(ApiException.class);
        assertThat(users.findById(user.getId()).orElseThrow().getGoogleSubject()).isNull();
        String expired=ticket();db.update("update auth.identity_actions set expires_at=?",Timestamp.from(Instant.now().minusSeconds(1)));
        assertThatThrownBy(()->oauth.beginLink(expired,OAuthService.challenge(VERIFIER))).isInstanceOf(ApiException.class);
    }
    @Test void mismatchedEmailUnverifiedAndDuplicateSubjectsCannotLink()throws Exception{
        var action=oauth.beginLink(ticket(),OAuthService.challenge(VERIFIER));
        assertThatThrownBy(()->oauth.completeLink(action.userId(),action.sessionId(),"new",user.getEmail(),false)).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->oauth.completeLink(action.userId(),action.sessionId(),"new","other@example.lk",true)).isInstanceOf(ApiException.class);
        User other=users.saveAndFlush(new User("Other","other@example.lk",null,null));other.setGoogleSubject("taken-subject");users.saveAndFlush(other);
        assertThatThrownBy(()->oauth.completeLink(action.userId(),action.sessionId(),"taken-subject",user.getEmail(),true)).isInstanceOf(ApiException.class);
        assertThat(users.findById(user.getId()).orElseThrow().getGoogleSubject()).isNull();
    }
    @Test void logoutAndDeactivationInvalidatePendingLink()throws Exception{
        var action=oauth.beginLink(ticket(),OAuthService.challenge(VERIFIER));sessions.revoke(browser.refreshToken());
        assertThatThrownBy(()->oauth.completeLink(action.userId(),action.sessionId(),"new",user.getEmail(),true)).isInstanceOf(ApiException.class);
        browser=sessions.start(user.getId(),null);String raw=ticket();user.setActive(false);users.saveAndFlush(user);
        assertThatThrownBy(()->oauth.beginLink(raw,OAuthService.challenge(VERIFIER))).isInstanceOf(ApiException.class);
        assertThat(users.findById(user.getId()).orElseThrow().getGoogleSubject()).isNull();
    }
}
