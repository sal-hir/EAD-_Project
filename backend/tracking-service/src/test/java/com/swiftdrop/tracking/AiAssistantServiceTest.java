package com.swiftdrop.tracking;

import com.swiftdrop.tracking.dto.AiChatRequest;
import com.swiftdrop.tracking.dto.AiChatResponse;
import com.swiftdrop.tracking.entity.TrackingParcel;
import com.swiftdrop.tracking.repository.TrackingParcelRepository;
import com.swiftdrop.tracking.service.AiAssistantService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class AiAssistantServiceTest {

    @Autowired
    private AiAssistantService aiAssistantService;

    @Autowired
    private TrackingParcelRepository parcelRepository;

    @BeforeEach
    public void setup() {
        parcelRepository.deleteAll();

        TrackingParcel parcel = new TrackingParcel();
        parcel.setTrackingNumber("SWIFT-777-LK");
        parcel.setStatus("PICKED_UP");
        parcel.setOriginCity("Colombo");
        parcel.setDestinationCity("Galle");
        parcel.setWeightKg(1.8);
        parcel.setEstimatedDelivery(Instant.now().plusSeconds(7200));
        parcelRepository.save(parcel);
    }

    @Test
    public void testAiChat_TracksParcelSuccessfully() {
        AiChatRequest request = new AiChatRequest();
        request.setMessage("Can you track my parcel SWIFT-777-LK?");

        AiChatResponse response = aiAssistantService.processChat(request);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertTrue(response.getToolsInvoked().contains("trackParcel"));
        assertTrue(response.getReply().contains("SWIFT-777-LK"));
        assertTrue(response.getReply().contains("PICKED_UP"));
    }

    @Test
    public void testAiChat_EstimatesFeeSuccessfully() {
        AiChatRequest request = new AiChatRequest();
        request.setMessage("How much will it cost to send a 3 kg parcel to Kandy?");

        AiChatResponse response = aiAssistantService.processChat(request);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertTrue(response.getToolsInvoked().contains("estimateShippingRate"));
        assertTrue(response.getReply().contains("LKR"));
        assertTrue(response.getReply().contains("Kandy"));
    }

    @Test
    public void testAiChat_GreetingPrompt() {
        AiChatRequest request = new AiChatRequest();
        request.setMessage("Hello, good morning!");

        AiChatResponse response = aiAssistantService.processChat(request);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertTrue(response.getReply().contains("SwiftDrop AI"));
    }
}
