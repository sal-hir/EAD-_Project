package com.swiftdrop.merchant;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swiftdrop.merchant.dto.MerchantDtos.Business;
import com.swiftdrop.merchant.dto.WebhookDtos.Update;
import com.swiftdrop.merchant.entity.Application;
import com.swiftdrop.merchant.repository.ApplicationRepository;
import com.swiftdrop.merchant.service.WebhookService;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import static org.assertj.core.api.Assertions.*;

/** Explicit opt-in: real public HTTPS transport, isolated H2, synthetic business/event only. */
@EnabledIfSystemProperty(named="webhook.live.tests",matches="true")
@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
@Import(ApiKeyIntegrationTest.Identities.class)
class LiveWebhookVerificationTest {
    @Autowired WebhookService hooks;@Autowired ApplicationRepository applications;
    @Autowired JdbcTemplate db;@Autowired ObjectMapper json;
    @Test void publicReceiverVerifiesHmacAndRealFailureRetrySuccess()throws Exception {
        String base=System.getenv("SWIFTDROP_LIVE_WEBHOOK_URL");
        assertThat(base).isNotBlank().startsWith("https://");
        Path folder=Path.of(System.getenv("SWIFTDROP_LIVE_WEBHOOK_DIR"));
        UUID owner=UUID.randomUUID();
        var app=new Application(owner,new Business("Synthetic verification shop",null,null,"Test","Test","synthetic@example.invalid",
            "+94770000000","Synthetic test address","Test district",null,null));
        app.approved();applications.saveAndFlush(app);UUID merchant=app.getId();
        String route="/verify/"+UUID.randomUUID();String url=base.replaceAll("/$","")+route;
        try {
            String secret=hooks.save(merchant,new Update(url,true)).signingSecret();
            Files.writeString(folder.resolve("config.json"),json.writeValueAsString(Map.of("path",route,"secret",secret)));
            var invalid=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(15))
                .header("Content-Type","application/json").header("X-SwiftDrop-Timestamp",Long.toString(Instant.now().getEpochSecond()))
                .header("X-SwiftDrop-Signature","v1="+"0".repeat(64)).POST(HttpRequest.BodyPublishers.ofString("{}")).build();
            assertThat(HttpClient.newHttpClient().send(invalid,HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(401);
            UUID delivery=hooks.test(merchant);Instant first=Instant.now().plusSeconds(1).truncatedTo(java.time.temporal.ChronoUnit.MICROS);
            hooks.dispatchDue(first);
            var failed=hooks.detail(merchant,delivery);
            assertThat(failed.delivery().state()).isEqualTo("RETRY");
            assertThat(failed.attempts().getFirst().responseStatus()).isEqualTo(503);
            Instant due=db.queryForObject("select next_attempt_at from merchant.webhook_deliveries where id=?",Timestamp.class,delivery).toInstant();
            assertThat(due).isEqualTo(first.plusSeconds(30));
            hooks.dispatchDue(due.minusSeconds(1));
            assertThat(hooks.detail(merchant,delivery).attempts()).hasSize(1);
            // Exercise persisted due-time eligibility without waiting 30 wall-clock seconds.
            hooks.dispatchDue(due);
            var completed=hooks.detail(merchant,delivery);
            assertThat(completed.delivery().state()).isEqualTo("DELIVERED");
            assertThat(completed.attempts()).hasSize(2);
            assertThat(completed.attempts().getLast().responseStatus()).isEqualTo(204);
            var receipts=json.readTree(Files.readString(folder.resolve("receipts.json")));
            assertThat(receipts.size()).isEqualTo(2);
            assertThat(receipts.get(0).path("verified").asBoolean()).isTrue();
            assertThat(receipts.get(1).path("verified").asBoolean()).isTrue();
            assertThat(receipts.get(0).path("bodyHash")).isEqualTo(receipts.get(1).path("bodyHash"));
            assertThat(receipts.get(0).path("eventId").asText()).isEqualTo(delivery.toString());
            assertThat(receipts.get(1).path("eventId").asText()).isEqualTo(delivery.toString());
        } finally {
            Files.deleteIfExists(folder.resolve("config.json"));
            applications.deleteById(merchant); // Isolated H2 only, never the configured Neon database.
        }
    }
}
