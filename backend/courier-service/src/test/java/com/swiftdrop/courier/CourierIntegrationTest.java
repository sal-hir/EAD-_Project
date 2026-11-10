package com.swiftdrop.courier;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swiftdrop.courier.client.IdentityGateway;
import com.swiftdrop.courier.dto.AvailabilityRequest;
import com.swiftdrop.courier.dto.StatusUpdateRequest;
import com.swiftdrop.courier.entity.Courier;
import com.swiftdrop.courier.entity.CourierParcel;
import com.swiftdrop.courier.entity.DeliveryStatus;
import com.swiftdrop.courier.exception.ApiFailure;
import com.swiftdrop.courier.repository.CourierParcelRepository;
import com.swiftdrop.courier.repository.CourierRepository;
import com.swiftdrop.courier.repository.ParcelStatusHistoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(CourierIntegrationTest.TestIdentityConfig.class)
class CourierIntegrationTest {

    static final UUID COURIER_A_USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    static final UUID COURIER_B_USER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    static final UUID ADMIN_USER_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

    static class FakeIdentityGateway implements IdentityGateway {
        @Override
        public Caller validate(String token) {
            return switch (token) {
                case "courier-a" -> new Caller(COURIER_A_USER_ID, "COURIER", "courierA@swiftdrop.lk", "Courier A", "+94771111111");
                case "courier-b" -> new Caller(COURIER_B_USER_ID, "COURIER", "courierB@swiftdrop.lk", "Courier B", "+94772222222");
                case "admin" -> new Caller(ADMIN_USER_ID, "ADMIN", "admin@swiftdrop.lk", "Admin", "+94773333333");
                default -> throw new ApiFailure(401, "Invalid token");
            };
        }
    }

    @TestConfiguration
    static class TestIdentityConfig {
        @Bean
        @Primary
        FakeIdentityGateway fakeIdentityGateway() {
            return new FakeIdentityGateway();
        }
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired CourierRepository courierRepository;
    @Autowired CourierParcelRepository parcelRepository;
    @Autowired ParcelStatusHistoryRepository historyRepository;

    private Courier courierA;
    private Courier courierB;
    private CourierParcel parcelOfCourierA;

    @BeforeEach
    void setup() {
        historyRepository.deleteAll();
        parcelRepository.deleteAll();
        courierRepository.deleteAll();

        // Seed Courier A
        courierA = new Courier();
        courierA.setUserId(COURIER_A_USER_ID);
        courierA.setName("Courier A");
        courierA.setPhone("+94771111111");
        courierA.setVehicleType("MOTORCYCLE");
        courierA.setLicenseNo("WP-AB-1234");
        courierA.setZone("COLOMBO");
        courierA.setAvailable(true);
        courierA = courierRepository.save(courierA);

        // Seed Courier B
        courierB = new Courier();
        courierB.setUserId(COURIER_B_USER_ID);
        courierB.setName("Courier B");
        courierB.setPhone("+94772222222");
        courierB.setVehicleType("VAN");
        courierB.setLicenseNo("WP-CD-5678");
        courierB.setZone("GAMPAHA");
        courierB.setAvailable(true);
        courierB = courierRepository.save(courierB);

        // Seed Parcel assigned to Courier A
        parcelOfCourierA = new CourierParcel();
        parcelOfCourierA.setTrackingNumber("SD-10001");
        parcelOfCourierA.setCourierId(courierA.getId());
        parcelOfCourierA.setStatus(DeliveryStatus.PENDING_PICKUP);
        parcelOfCourierA.setRecipientName("Nimal Silva");
        parcelOfCourierA.setRecipientPhone("+94770000000");
        parcelOfCourierA.setDropoffAddress("45 Galle Road, Colombo 03");
        parcelOfCourierA = parcelRepository.save(parcelOfCourierA);
    }

    @Test
    void courierCanViewAssignedDeliveries() throws Exception {
        mvc.perform(get("/api/v1/couriers/my-deliveries")
                .header("Authorization", "Bearer courier-a"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.courier.name").value("Courier A"))
            .andExpect(jsonPath("$.data.parcels[0].trackingNumber").value("SD-10001"))
            .andExpect(jsonPath("$.data.parcels[0].status").value("PENDING_PICKUP"));
    }

    @Test
    void courierIsolationTest_courierBCannotUpdateCourierAParcel() throws Exception {
        // Crucial EAD Rubric Requirement: Courier B receives HTTP 403 Forbidden when accessing Courier A's parcel
        var updateRequest = new StatusUpdateRequest(DeliveryStatus.PICKED_UP, "Attempting unauthorized status update", null, null);

        mvc.perform(patch("/api/v1/couriers/parcels/" + parcelOfCourierA.getId() + "/status")
                .header("Authorization", "Bearer courier-b")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(updateRequest)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("Access denied: This parcel is not assigned to you"));
    }

    @Test
    void courierCanUpdateOwnParcelStatusStepByStep() throws Exception {
        // Step 1: PENDING_PICKUP -> PICKED_UP
        var req1 = new StatusUpdateRequest(DeliveryStatus.PICKED_UP, "Parcel collected from hub", null, null);
        mvc.perform(patch("/api/v1/couriers/parcels/" + parcelOfCourierA.getId() + "/status")
                .header("Authorization", "Bearer courier-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req1)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("PICKED_UP"));

        // Step 2: PICKED_UP -> IN_TRANSIT
        var req2 = new StatusUpdateRequest(DeliveryStatus.IN_TRANSIT, "On delivery route", null, null);
        mvc.perform(patch("/api/v1/couriers/parcels/" + parcelOfCourierA.getId() + "/status")
                .header("Authorization", "Bearer courier-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req2)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("IN_TRANSIT"));

        // Step 3: IN_TRANSIT -> OUT_FOR_DELIVERY
        var req3 = new StatusUpdateRequest(DeliveryStatus.OUT_FOR_DELIVERY, "Arriving in 15 mins", null, null);
        mvc.perform(patch("/api/v1/couriers/parcels/" + parcelOfCourierA.getId() + "/status")
                .header("Authorization", "Bearer courier-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req3)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("OUT_FOR_DELIVERY"));

        // Step 4: OUT_FOR_DELIVERY -> DELIVERED (with proof image)
        var req4 = new StatusUpdateRequest(DeliveryStatus.DELIVERED, "Handed to recipient", "/uploads/proof-123.jpg", null);
        mvc.perform(patch("/api/v1/couriers/parcels/" + parcelOfCourierA.getId() + "/status")
                .header("Authorization", "Bearer courier-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req4)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("DELIVERED"))
            .andExpect(jsonPath("$.data.proofImageUrl").value("/uploads/proof-123.jpg"))
            .andExpect(jsonPath("$.data.deliveredAt").isNotEmpty());

        assertThat(historyRepository.count()).isEqualTo(4);
    }

    @Test
    void invalidStatusTransitionIsRejected() throws Exception {
        // Cannot jump directly from PENDING_PICKUP to DELIVERED
        var invalidReq = new StatusUpdateRequest(DeliveryStatus.DELIVERED, "Skipped steps", null, null);

        mvc.perform(patch("/api/v1/couriers/parcels/" + parcelOfCourierA.getId() + "/status")
                .header("Authorization", "Bearer courier-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(invalidReq)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("Invalid status transition from PENDING_PICKUP to DELIVERED"));
    }

    @Test
    void markingAsFailedRequiresMandatoryFailureReason() throws Exception {
        // Missing failure reason -> 400 Bad Request
        var reqWithoutReason = new StatusUpdateRequest(DeliveryStatus.FAILED, "Cannot deliver", null, "");

        mvc.perform(patch("/api/v1/couriers/parcels/" + parcelOfCourierA.getId() + "/status")
                .header("Authorization", "Bearer courier-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(reqWithoutReason)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("A failure reason is mandatory when marking a delivery as FAILED"));

        // With failure reason -> 200 OK
        var reqWithReason = new StatusUpdateRequest(DeliveryStatus.FAILED, "Cannot deliver", null, "Recipient not reachable by phone");

        mvc.perform(patch("/api/v1/couriers/parcels/" + parcelOfCourierA.getId() + "/status")
                .header("Authorization", "Bearer courier-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(reqWithReason)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("FAILED"))
            .andExpect(jsonPath("$.data.failureReason").value("Recipient not reachable by phone"));
    }

    @Test
    void courierCanToggleAvailability() throws Exception {
        var req = new AvailabilityRequest(false);

        mvc.perform(patch("/api/v1/couriers/availability")
                .header("Authorization", "Bearer courier-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.isAvailable").value(false));
    }

    @Test
    void proofPhotoUploadSucceeds() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "image",
            "proof.jpg",
            "image/jpeg",
            "mock image content".getBytes()
        );

        mvc.perform(multipart("/api/v1/uploads/proof")
                .file(file)
                .header("Authorization", "Bearer courier-a"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.url").value(org.hamcrest.Matchers.startsWith("/uploads/proof-")));
    }
}

