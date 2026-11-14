package com.swiftdrop.merchant;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swiftdrop.merchant.client.*;
import com.swiftdrop.merchant.dto.OrderDtos.Create;
import com.swiftdrop.merchant.exception.ApiFailure;
import java.net.URI;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.*;
import static org.assertj.core.api.Assertions.*;

class BookingGatewayIntegrationTest {
    final ObjectMapper json=new ObjectMapper().findAndRegisterModules();
    MockBookingServer mock;
    BookingGateway.Request request;
    @BeforeEach void setup() throws Exception {
        mock=new MockBookingServer(json);
        request=new BookingGateway.Request(UUID.randomUUID(),UUID.randomUUID(),json.readValue(OrderIntegrationTest.BODY,Create.class));
    }
    @AfterEach void cleanup() { mock.close(); }
    HttpBookingGateway gateway() { return new HttpBookingGateway(mock.endpoint(),"mock-private-service-key",json,Duration.ofSeconds(2)); }
    @Test void sendsProposedContractOverHttpAndRetriesReuseUpstreamBooking() throws Exception {
        var first=gateway().create(request); var retry=gateway().create(request);
        assertThat(retry).isEqualTo(first);
        assertThat(first.orderId()).isEqualTo(request.orderId());
        assertThat(first.parcelId()).isNotNull(); assertThat(first.trackingNumber()).startsWith("MOCK-");
        assertThat(mock.created.get()).isEqualTo(1);
        assertThat(mock.lastKey).isEqualTo(request.orderId().toString());
        var sent=json.readTree(mock.lastBody);
        assertThat(sent.path("merchantId").asText()).isEqualTo(request.merchantId().toString());
        assertThat(sent.path("order").path("merchantOrderId").asText()).isEqualTo("SHOP-123");
        assertThat(mock.lastBody).doesNotContain("mock-private-service-key","apiKey","accessToken");
    }
    @Test void upstreamErrorsAndBadServiceCredentialFailWithoutLeakingRemoteDetails() {
        mock.responseStatus=503; mock.forcedBody="private remote diagnostic";
        assertUnavailable(gateway());
        assertUnavailable(new HttpBookingGateway(mock.endpoint(),"wrong-private-key",json,Duration.ofSeconds(2)));
    }
    @Test void malformedIncompleteAndMismatchedBookingResponsesFailClosed() {
        for(String body:java.util.List.of("not json","{}","{\"success\":true,\"data\":null}",
            "{\"success\":true,\"data\":{\"orderId\":\""+UUID.randomUUID()+"\",\"parcelId\":\""+UUID.randomUUID()+"\",\"trackingNumber\":\"MOCK-1\",\"status\":\"CREATED\"}}")) {
            mock.forcedBody=body; assertUnavailable(gateway());
        }
    }
    @Test void timeoutCanBeRetriedWithSameOrderIdentity() throws Exception {
        mock.delayMillis=250;
        assertUnavailable(new HttpBookingGateway(mock.endpoint(),"mock-private-service-key",json,Duration.ofMillis(100)));
        mock.delayMillis=0;
        var booking=gateway().create(request);
        assertThat(booking.orderId()).isEqualTo(request.orderId());
        assertThat(mock.created.get()).isEqualTo(1);
    }
    @Test void remotePlainHttpAndCredentialInUrlAreRejected() {
        for(String endpoint:java.util.List.of("http://shop.example/api","https://user:secret@shop.example/api","https://shop.example/api?secret=x"))
            assertThatIllegalArgumentException().isThrownBy(()->new HttpBookingGateway(URI.create(endpoint),"key",json,Duration.ofSeconds(1)));
    }
    void assertUnavailable(BookingGateway gateway) {
        assertThatThrownBy(()->gateway.create(request)).isInstanceOfSatisfying(ApiFailure.class,
            failure->{assertThat(failure.status()).isEqualTo(503);assertThat(failure.getMessage()).doesNotContain("private remote diagnostic","wrong-private-key");});
    }
}
