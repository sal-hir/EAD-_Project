package com.swiftdrop.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swiftdrop.auth.entity.*;
import com.swiftdrop.auth.entity.Role;
import com.swiftdrop.auth.repository.*;
import com.swiftdrop.auth.security.*;
import com.swiftdrop.auth.service.*;
import java.net.URI;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.*;
import org.springframework.context.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
@Import(PasswordRecoveryTest.MailConfig.class)
class PasswordRecoveryTest {
    record Mail(String address,String url){@Override public String toString(){return "Mail[redacted]";}}
    static class Mailbox implements RecoveryMailer {
        final Queue<Mail> messages=new ConcurrentLinkedQueue<>();volatile boolean fail;
        public void send(String email,String url){if(fail)throw new IllegalStateException("Simulated SMTP outage");messages.add(new Mail(email,url));}
    }
    @TestConfiguration static class MailConfig {@Bean @Primary Mailbox mailbox(){return new Mailbox();}}
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired UserRepository users;@Autowired OAuthCodeRepository codes;
    @Autowired PasswordEncoder passwords;@Autowired BrowserSessionService sessions;@Autowired JdbcTemplate db;@Autowired Mailbox mail;
    @Autowired @Qualifier("recoveryExecutor") ThreadPoolTaskExecutor executor;
    static final String OLD="ExistingTest@123!",NEW="ReplacementTest@123!",EMAIL="reset@example.lk";
    @BeforeEach void setup(){idle();codes.deleteAll();users.deleteAll();db.update("delete from auth.recovery_rate_limits");mail.messages.clear();mail.fail=false;}
    void idle(){await().atMost(Duration.ofSeconds(10)).until(()->executor.getActiveCount()==0&&executor.getThreadPoolExecutor().getQueue().isEmpty());}
    User fixture(Role role){User u=new User("Recovery test",EMAIL,passwords.encode(OLD),null);u.setRole(role);return users.saveAndFlush(u);}
    String forgot(String email)throws Exception{
        long completed=executor.getThreadPoolExecutor().getCompletedTaskCount();
        var response=mvc.perform(post("/api/v1/auth/password/forgot").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("email",email))))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andReturn().getResponse();
        await().atMost(Duration.ofSeconds(10)).until(()->executor.getThreadPoolExecutor().getCompletedTaskCount()>completed);idle();return response.getContentAsString();
    }
    String token(){return URI.create(mail.messages.peek().url()).getFragment().substring("token=".length());}
    ResultActions reset(String token,String password)throws Exception{return mvc.perform(post("/api/v1/auth/password/reset").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("token",token,"newPassword",password))));}
    ResultActions login(String password)throws Exception{return mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("email",EMAIL,"password",password))));}
    @ParameterizedTest @EnumSource(Role.class)
    void allPasswordRolesCanRecoverAndEverySessionIsRevoked(Role role)throws Exception{
        var user=fixture(role);var browser=sessions.start(user.getId(),null);String response=forgot(EMAIL);
        assertThat(mail.messages).hasSize(1);String token=token();assertThat(response).doesNotContain(token);
        assertThat(db.queryForObject("select token_hash from auth.password_reset_tokens",String.class)).isEqualTo(BrowserSessionService.hash(token));
        reset(token,NEW).andExpect(status().isNoContent());login(OLD).andExpect(status().isUnauthorized());login(NEW).andExpect(status().isOk());
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+browser.login().token())).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/refresh").header(SessionCookies.CSRF_HEADER,"1").cookie(new jakarta.servlet.http.Cookie(SessionCookies.NAME,browser.refreshToken()))).andExpect(status().isUnauthorized());
        reset(token,NEW).andExpect(status().isUnauthorized());
        assertThat(passwords.matches(NEW,users.findById(user.getId()).orElseThrow().getPasswordHash())).isTrue();
    }
    @Test void unknownGoogleOnlyAndEligibleResponsesAreIndistinguishable()throws Exception{
        fixture(Role.CUSTOMER);String eligible=forgot(EMAIL);String unknown=forgot("absent@example.lk");
        User google=users.saveAndFlush(new User("Google","google-reset@example.lk",null,null));google.setGoogleSubject("reset-google");users.saveAndFlush(google);
        String googleResponse=forgot(google.getEmail());assertThat(unknown).isEqualTo(eligible).isEqualTo(googleResponse);assertThat(mail.messages).hasSize(1);
        assertThat(users.findById(google.getId()).orElseThrow().getPasswordHash()).isNull();
    }
    @Test void expiryInvalidTokensAndWeakPasswordsAreRejected()throws Exception{
        fixture(Role.CUSTOMER);forgot(EMAIL);String token=token();reset(token,"short").andExpect(status().isBadRequest());
        reset("bad",NEW).andExpect(status().isBadRequest());reset("x".repeat(43),NEW).andExpect(status().isUnauthorized());
        db.update("update auth.password_reset_tokens set expires_at=?",Timestamp.from(Instant.now().minusSeconds(1)));
        reset(token,NEW).andExpect(status().isUnauthorized());login(OLD).andExpect(status().isOk());
    }
    @Test void twoConcurrentConsumersHaveOneWinner()throws Exception{
        fixture(Role.CUSTOMER);forgot(EMAIL);String token=token();
        try(var pool=Executors.newFixedThreadPool(2)){
            CountDownLatch start=new CountDownLatch(1);Callable<Integer> attempt=()->{start.await();return reset(token,NEW).andReturn().getResponse().getStatus();};
            var a=pool.submit(attempt);var b=pool.submit(attempt);start.countDown();
            assertThat(List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(204,401);
        }
    }
    @Test void failureToDeliverDeletesUnsentTokenAndDoesNotRevealAccount()throws Exception{
        fixture(Role.CUSTOMER);mail.fail=true;String failure=forgot(EMAIL);assertThat(mail.messages).isEmpty();
        assertThat(db.queryForObject("select count(*) from auth.password_reset_tokens",Integer.class)).isZero();
        assertThat(failure).isEqualTo(forgot("absent@example.lk"));
    }
    @Test void emailAndIpLimitsArePersistentAndIndependentOfEligibility()throws Exception{
        fixture(Role.CUSTOMER);for(int i=0;i<3;i++)forgot(EMAIL);
        int count=mail.messages.size();mvc.perform(post("/api/v1/auth/password/forgot").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("email",EMAIL)))).andExpect(status().isOk());idle();assertThat(mail.messages).hasSize(count);
        db.update("delete from auth.recovery_rate_limits");
        for(int i=0;i<20;i++)forgot("unknown-"+i+"@example.lk");
        mvc.perform(post("/api/v1/auth/password/forgot").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("email",EMAIL)))).andExpect(status().isOk());idle();assertThat(mail.messages).hasSize(count);
    }
    @Test void inactiveAccountsAndOutstandingTokensCannotBeUsed()throws Exception{
        var user=fixture(Role.CUSTOMER);forgot(EMAIL);String first=token();forgot(EMAIL);String second=URI.create(mail.messages.stream().skip(1).findFirst().orElseThrow().url()).getFragment().substring(6);
        reset(first,NEW).andExpect(status().isNoContent());reset(second,NEW).andExpect(status().isUnauthorized());
        mail.messages.clear();forgot(EMAIL);String inactive=token();user=users.findById(user.getId()).orElseThrow();user.setActive(false);users.saveAndFlush(user);
        reset(inactive,OLD).andExpect(status().isUnauthorized());
    }
}
