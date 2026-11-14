package com.swiftdrop.tracking.controller;

import com.swiftdrop.tracking.dto.AiChatRequest;
import com.swiftdrop.tracking.dto.AiChatResponse;
import com.swiftdrop.tracking.service.AiAssistantService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/ai")
public class AiChatController {

    private final AiAssistantService aiAssistantService;

    public AiChatController(AiAssistantService aiAssistantService) {
        this.aiAssistantService = aiAssistantService;
    }

    /**
     * GenAI Delivery Assistant endpoint with MCP tool calling.
     * Answers queries like "Where is my parcel?" or "How much to send 2 kg to Kandy?"
     */
    @PostMapping("/chat")
    public ResponseEntity<AiChatResponse> chat(@Valid @RequestBody AiChatRequest request) {
        AiChatResponse response = aiAssistantService.processChat(request);
        return ResponseEntity.ok(response);
    }
}
