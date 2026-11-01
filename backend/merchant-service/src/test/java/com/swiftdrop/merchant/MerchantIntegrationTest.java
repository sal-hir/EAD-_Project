package com.swiftdrop.merchant;

import com.fasterxml.jackson.databind.*;
import com.swiftdrop.merchant.client.IdentityGateway;
import com.swiftdrop.merchant.dto.MerchantDtos.*;
import com.swiftdrop.merchant.exception.ApiFailure;
import com.swiftdrop.merchant.repository.ApplicationRepository;
import com.swiftdrop.merchant.service.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.*;
import org.springframework.context.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
@Import(MerchantIntegrationTest.IdentityConfig.class)
class MerchantIntegrationTest {
    static final UUID CUSTOMER=UUID.randomUUID(),MERCHANT=UUID.randomUUID(),ADMIN=UUID.randomUUID(),OTHER=UUID.randomUUID();
    static class FakeIdentity implements IdentityGateway {
        volatile boolean outage;final Set<UUID> grants=ConcurrentHashMap.newKeySet();final AtomicInteger calls=new AtomicInteger();
        public Caller validate(String token){return switch(token){case "customer"->new Caller(CUSTOMER,"CUSTOMER");case "other"->new Caller(OTHER,"CUSTOMER");case "merchant"->new Caller(MERCHANT,"MERCHANT");case "admin"->new Caller(ADMIN,"ADMIN");case "courier"->new Caller(OTHER,"COURIER");case "dispatcher"->new Caller(OTHER,"DISPATCHER");default->throw new ApiFailure(401,"Invalid token");};}
        public void grantMerchant(String token,UUID application,UUID user){calls.incrementAndGet();if(outage)throw new ApiFailure(503,"Auth unavailable");grants.add(application);}
    }
    @TestConfiguration static class IdentityConfig {@Bean @Primary FakeIdentity fakeIdentity(){return new FakeIdentity();}}
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired ApplicationRepository applications;@Autowired JdbcTemplate db;
    @Autowired ApplicationService service;@Autowired ApprovalService approvals;@Autowired FakeIdentity identity;
    @BeforeEach void setup(){db.update("delete from merchant.approval_audit");applications.deleteAll();identity.outage=false;identity.grants.clear();identity.calls.set(0);}
    Map<String,Object> business(){return new HashMap<>(Map.of("businessName","Colombo Trading","category","Retail","contactName","Kamal","businessEmail","business@example.lk","phone","+94 77 123 4567","address","1 Example Road","district","Colombo"));}
    ResultActions submit(String token,Map<String,Object> body)throws Exception{return mvc.perform(post("/api/v1/merchants/applications").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body)));}
    JsonNode data(ResultActions action)throws Exception{return json.readTree(action.andReturn().getResponse().getContentAsString()).path("data");}
    ResultActions postAs(String token,String path,Object body)throws Exception{return mvc.perform(post("/api/v1/merchants"+path).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body)));}
    @ParameterizedTest @ValueSource(strings={"customer","merchant"})
    void eligibleIdentitiesSubmitOnceAndSeeOnlyThemselves(String token)throws Exception{
        submit(token,business()).andExpect(status().isCreated()).andExpect(jsonPath("$.data.status").value("PENDING"));
        submit(token,business()).andExpect(status().isConflict());
        mvc.perform(get("/api/v1/merchants/applications/me").header("Authorization","Bearer "+token)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/merchants/applications/me").header("Authorization","Bearer other")).andExpect(status().isNotFound());
        assertThat(identity.grants).isEmpty();assertThat(applications.count()).isEqualTo(1);
    }
    @Test void validationAndIdentityOrStatusInjectionAreRejected()throws Exception{
        var body=business();body.put("userId",OTHER);submit("customer",body).andExpect(status().isBadRequest());
        body=business();body.put("status","APPROVED");submit("customer",body).andExpect(status().isBadRequest());
        body=business();body.put("businessEmail","invalid");submit("customer",body).andExpect(status().isBadRequest());
        body=business();body.put("website","javascript:alert(1)");submit("customer",body).andExpect(status().isBadRequest());
    }
    @ParameterizedTest @ValueSource(strings={"customer","merchant","courier","dispatcher"})
    void onlyAdminMayReviewOrDecide(String token)throws Exception{
        var a=data(submit("customer",business()).andExpect(status().isCreated()));String id=a.path("id").asText();
        mvc.perform(get("/api/v1/merchants/admin/applications").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        postAs(token,"/admin/applications/"+id+"/approve",Map.of("version",0)).andExpect(status().isForbidden());
        postAs(token,"/admin/applications/"+id+"/reject",Map.of("version",0,"reason","No")).andExpect(status().isForbidden());
    }
    @Test void missingAndInvalidTokensAndUnknownUserHeadersCannotAuthenticate()throws Exception{
        mvc.perform(get("/api/v1/merchants/applications/me").header("X-User-Id",CUSTOMER)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/merchants/applications/me").header("Authorization","Bearer forged")).andExpect(status().isUnauthorized());
        submit("courier",business()).andExpect(status().isForbidden());
    }
    @Test void adminReviewsApprovesAndRetriesIdempotently()throws Exception{
        var a=data(submit("merchant",business()).andExpect(status().isCreated()));String id=a.path("id").asText();
        mvc.perform(get("/api/v1/merchants/profile").header("Authorization","Bearer merchant")).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/merchants/admin/applications").param("status","PENDING").param("search","Colombo").header("Authorization","Bearer admin"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(1));
        postAs("admin","/admin/applications/"+id+"/approve",Map.of("version",0)).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("APPROVED"));
        postAs("admin","/admin/applications/"+id+"/approve",Map.of("version",0)).andExpect(status().isOk());assertThat(identity.calls.get()).isEqualTo(1);
        mvc.perform(get("/api/v1/merchants/profile").header("Authorization","Bearer merchant")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/merchants/admin/applications/"+id+"/audit").header("Authorization","Bearer admin"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].action").value("APPROVED"));
    }
    @Test void rejectionRequiresReasonAndControlledCorrectionResubmissionWorks()throws Exception{
        var a=data(submit("customer",business()).andExpect(status().isCreated()));String id=a.path("id").asText();
        postAs("admin","/admin/applications/"+id+"/reject",Map.of("version",0,"reason"," ")).andExpect(status().isBadRequest());
        var rejected=data(postAs("admin","/admin/applications/"+id+"/reject",Map.of("version",0,"reason","Correct the address")).andExpect(status().isOk()));
        assertThat(rejected.path("rejectionReason").asText()).isEqualTo("Correct the address");
        var corrected=business();corrected.put("address","2 Corrected Road");
        var edited=data(mvc.perform(put("/api/v1/merchants/applications/me").header("Authorization","Bearer customer").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsBytes(Map.of("business",corrected,"version",rejected.path("version").asLong())))).andExpect(status().isOk()));
        postAs("customer","/applications/me/resubmit",Map.of("version",edited.path("version").asLong())).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("PENDING"));
    }
    @Test void outageKeepsApprovingAndRetryReconciles()throws Exception{
        var a=data(submit("customer",business()).andExpect(status().isCreated()));String id=a.path("id").asText();identity.outage=true;
        postAs("admin","/admin/applications/"+id+"/approve",Map.of("version",0)).andExpect(status().isAccepted()).andExpect(jsonPath("$.data.status").value("APPROVING")).andExpect(jsonPath("$.data.syncError").exists());
        postAs("admin","/admin/applications/"+id+"/reject",Map.of("version",0,"reason","Conflict")).andExpect(status().isConflict());
        assertThat(identity.grants).isEmpty();identity.outage=false;
        postAs("admin","/admin/applications/"+id+"/approve",Map.of("version",0)).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("APPROVED"));
    }
    @Test void successfulRemoteGrantBeforeLocalCommitCanBeReconciled()throws Exception{
        var a=data(submit("customer",business()).andExpect(status().isCreated()));UUID id=UUID.fromString(a.path("id").asText());
        var actor=identity.validate("admin");service.beginApproval(actor,id,0);identity.grantMerchant("admin",id,CUSTOMER);
        assertThat(applications.findById(id).orElseThrow().getStatus()).isEqualTo(Status.APPROVING);
        var approved=approvals.approve(actor,id,0,"admin");assertThat(approved.status()).isEqualTo(Status.APPROVED);assertThat(identity.grants).hasSize(1);
    }
    @Test void concurrentConflictingDecisionsHaveOneWinner()throws Exception{
        var a=data(submit("customer",business()).andExpect(status().isCreated()));UUID id=UUID.fromString(a.path("id").asText());
        try(var pool=Executors.newFixedThreadPool(2)){
            CountDownLatch start=new CountDownLatch(1);
            var approve=pool.submit(()->{start.await();try{service.beginApproval(identity.validate("admin"),id,0);return true;}catch(ApiFailure e){return false;}});
            var reject=pool.submit(()->{start.await();try{service.reject(identity.validate("admin"),id,new Rejection(0L,"Not eligible"));return true;}catch(ApiFailure e){return false;}});start.countDown();
            assertThat(List.of(approve.get(10,TimeUnit.SECONDS),reject.get(10,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }
    }
    @Test void staleReviewsAndApprovedEditsCannotChangeState()throws Exception{
        var a=data(submit("merchant",business()).andExpect(status().isCreated()));String id=a.path("id").asText();
        mvc.perform(put("/api/v1/merchants/applications/me").header("Authorization","Bearer merchant").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("business",business(),"version",99)))).andExpect(status().isConflict());
        postAs("admin","/admin/applications/"+id+"/approve",Map.of("version",99)).andExpect(status().isConflict());
        postAs("admin","/admin/applications/"+id+"/approve",Map.of("version",0)).andExpect(status().isOk());
        mvc.perform(put("/api/v1/merchants/applications/me").header("Authorization","Bearer merchant").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("business",business(),"version",0)))).andExpect(status().isConflict());
        // Business state alone cannot authorize a CUSTOMER identity.
        assertThatThrownBy(()->service.business(new IdentityGateway.Caller(MERCHANT,"CUSTOMER"))).isInstanceOf(ApiFailure.class);
    }
    @Test void corsAllowsOnlyConfiguredOrigin()throws Exception{
        mvc.perform(options("/api/v1/merchants/applications").header("Origin","http://localhost:3000").header("Access-Control-Request-Method","PUT").header("Access-Control-Request-Headers","authorization,content-type")).andExpect(status().isOk());
        mvc.perform(options("/api/v1/merchants/applications").header("Origin","https://attacker.example").header("Access-Control-Request-Method","POST")).andExpect(status().isForbidden());
    }
}
