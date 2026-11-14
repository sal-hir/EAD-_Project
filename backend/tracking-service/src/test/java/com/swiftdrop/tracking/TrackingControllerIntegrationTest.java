package com.swiftdrop.tracking;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swiftdrop.tracking.dto.StatusUpdateEventRequest;
import com.swiftdrop.tracking.entity.TrackingParcel;
import com.swiftdrop.tracking.repository.TrackingParcelRepository;
import com.swiftdrop.tracking.service.TrackingCacheService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Optional;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class TrackingControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TrackingParcelRepository parcelRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TrackingCacheService cacheService;

    @BeforeEach
    public void setup() {
        parcelRepository.deleteAll();
        when(cacheService.get(anyString())).thenReturn(Optional.empty());
        doNothing().when(cacheService).put(anyString(), any());
        doNothing().when(cacheService).evict(anyString());
    }

    @Test
    public void testGetPublicTracking_Success() throws Exception {
        TrackingParcel parcel = new TrackingParcel();
        parcel.setTrackingNumber("SWIFT-999-LK");
        parcel.setStatus("IN_TRANSIT");
        parcel.setOriginCity("Colombo");
        parcel.setDestinationCity("Kandy");
        parcel.setWeightKg(2.5);
        parcel.setEstimatedDelivery(Instant.now().plusSeconds(3600));
        parcelRepository.save(parcel);

        mockMvc.perform(get("/api/v1/tracking/SWIFT-999-LK"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackingNumber", is("SWIFT-999-LK")))
                .andExpect(jsonPath("$.status", is("IN_TRANSIT")))
                .andExpect(jsonPath("$.originCity", is("Colombo")))
                .andExpect(jsonPath("$.destinationCity", is("Kandy")))
                .andExpect(jsonPath("$.recipientPhone").doesNotExist())
                .andExpect(jsonPath("$.recipientAddress").doesNotExist());
    }

    @Test
    public void testGetPublicTracking_NotFound() throws Exception {
        mockMvc.perform(get("/api/v1/tracking/NON-EXISTENT-TRK"))
                .andExpect(status().isNotFound());
    }

    @Test
    public void testRecordStatusUpdate_CreatesEventAndUpdatesStatus() throws Exception {
        StatusUpdateEventRequest request = new StatusUpdateEventRequest();
        request.setStatus("OUT_FOR_DELIVERY");
        request.setCity("Kandy Central");
        request.setDescription("Package loaded on courier delivery van");
        request.setOriginCity("Colombo");
        request.setDestinationCity("Kandy");
        request.setWeightKg(1.5);

        mockMvc.perform(post("/api/v1/tracking/SWIFT-888-LK/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackingNumber", is("SWIFT-888-LK")))
                .andExpect(jsonPath("$.status", is("OUT_FOR_DELIVERY")))
                .andExpect(jsonPath("$.events", hasSize(1)))
                .andExpect(jsonPath("$.events[0].status", is("OUT_FOR_DELIVERY")))
                .andExpect(jsonPath("$.events[0].city", is("Kandy Central")));
    }
}
