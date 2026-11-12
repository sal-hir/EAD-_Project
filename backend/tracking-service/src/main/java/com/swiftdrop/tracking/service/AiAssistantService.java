package com.swiftdrop.tracking.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.swiftdrop.tracking.dto.AiChatRequest;
import com.swiftdrop.tracking.dto.AiChatResponse;
import com.swiftdrop.tracking.dto.PublicTrackingResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AiAssistantService {

    private static final Logger log = LoggerFactory.getLogger(AiAssistantService.class);

    private final TrackingService trackingService;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${app.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${app.gemini.model:gemini-1.5-flash}")
    private String geminiModel;

    @Value("${app.gemini.endpoint:https://generativelanguage.googleapis.com/v1beta}")
    private String geminiEndpoint;

    public AiAssistantService(TrackingService trackingService, ObjectMapper objectMapper) {
        this.trackingService = trackingService;
        this.objectMapper = objectMapper;
        this.restTemplate = new RestTemplate();
    }

    public AiChatResponse processChat(AiChatRequest request) {
        String userPrompt = request.getMessage() != null ? request.getMessage().trim() : "";
        List<String> toolsInvoked = new ArrayList<>();

        if (userPrompt.isEmpty()) {
            return AiChatResponse.error("Please enter a question or query.");
        }

        // 1. If Gemini API Key is available, use LLM with Function Calling (MCP tool integration)
        if (geminiApiKey != null && !geminiApiKey.isBlank()) {
            try {
                return callGeminiWithTools(request, toolsInvoked);
            } catch (Exception ex) {
                log.warn("Gemini API call failed, falling back to local reasoning engine: {}", ex.getMessage());
            }
        }

        // 2. Intelligent local rule-based fallback (Guarantees 100% uptime for presentations without external API keys)
        return executeLocalFallbackEngine(userPrompt, toolsInvoked);
    }

    private AiChatResponse callGeminiWithTools(AiChatRequest request, List<String> toolsInvoked) {
        String url = String.format("%s/models/%s:generateContent?key=%s", geminiEndpoint, geminiModel, geminiApiKey);

        ObjectNode payload = objectMapper.createObjectNode();
        ArrayNode contents = payload.putArray("contents");

        // System prompt context
        ObjectNode systemInstruction = payload.putObject("system_instruction");
        ArrayNode systemParts = systemInstruction.putArray("parts");
        systemParts.addObject().put("text", 
            "You are SwiftDrop AI, a professional courier logistics assistant in Sri Lanka. " +
            "You help customers track parcels and calculate delivery rates. Always be helpful, concise, and polite. " +
            "Currency is Sri Lankan Rupees (LKR). When asked to track a parcel or calculate pricing, call the corresponding tool."
        );

        // Previous history
        if (request.getHistory() != null) {
            for (AiChatRequest.ChatMessage msg : request.getHistory()) {
                ObjectNode turn = contents.addObject();
                turn.put("role", "user".equalsIgnoreCase(msg.getRole()) ? "user" : "model");
                turn.putArray("parts").addObject().put("text", msg.getText());
            }
        }

        // User turn
        ObjectNode userTurn = contents.addObject();
        userTurn.put("role", "user");
        userTurn.putArray("parts").addObject().put("text", request.getMessage());

        // Define MCP Tools
        payload.set("tools", buildToolsDefinition());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(payload.toString(), headers);

        ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            return executeLocalFallbackEngine(request.getMessage(), toolsInvoked);
        }

        try {
            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode candidate = root.path("candidates").get(0);
            JsonNode content = candidate.path("content");
            JsonNode parts = content.path("parts");

            // Check if model called a function
            for (JsonNode part : parts) {
                if (part.has("functionCall")) {
                    JsonNode call = part.get("functionCall");
                    String funcName = call.get("name").asText();
                    JsonNode args = call.get("args");
                    toolsInvoked.add(funcName);

                    String toolResultJson = executeTool(funcName, args);

                    // Call model again with function result to synthesize final reply
                    return callGeminiFunctionResponse(url, contents, content, funcName, toolResultJson, toolsInvoked);
                }
            }

            // Normal text response
            String text = parts.get(0).path("text").asText();
            return AiChatResponse.of(text, toolsInvoked);

        } catch (Exception e) {
            log.error("Failed to parse Gemini response: {}", e.getMessage(), e);
            return executeLocalFallbackEngine(request.getMessage(), toolsInvoked);
        }
    }

    private AiChatResponse callGeminiFunctionResponse(String url, ArrayNode conversationContents,
                                                      JsonNode modelTurnWithCall, String funcName,
                                                      String toolResultJson, List<String> toolsInvoked) throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        ArrayNode contents = payload.putArray("contents");

        // Copy history + model turn
        for (JsonNode c : conversationContents) {
            contents.add(c);
        }
        contents.add(modelTurnWithCall);

        // Add function response turn
        ObjectNode fnTurn = contents.addObject();
        fnTurn.put("role", "user");
        ArrayNode fnParts = fnTurn.putArray("parts");
        ObjectNode fnRespPart = fnParts.addObject();
        ObjectNode fnResponse = fnRespPart.putObject("functionResponse");
        fnResponse.put("name", funcName);
        fnResponse.set("response", objectMapper.readTree(toolResultJson));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(payload.toString(), headers);

        ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
        JsonNode root = objectMapper.readTree(response.getBody());
        String text = root.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();

        return AiChatResponse.of(text, toolsInvoked);
    }

    private ArrayNode buildToolsDefinition() {
        ArrayNode tools = objectMapper.createArrayNode();
        ObjectNode toolObj = tools.addObject();
        ArrayNode funcDecls = toolObj.putArray("function_declarations");

        // Tool 1: trackParcel
        ObjectNode trackTool = funcDecls.addObject();
        trackTool.put("name", "trackParcel");
        trackTool.put("description", "Look up live parcel status, city location, and delivery events by tracking number.");
        ObjectNode trackParams = trackTool.putObject("parameters");
        trackParams.put("type", "OBJECT");
        ObjectNode trackProps = trackParams.putObject("properties");
        trackProps.putObject("trackingNumber")
            .put("type", "STRING")
            .put("description", "The tracking reference, e.g., SWIFT-1001-LK");
        trackParams.putArray("required").add("trackingNumber");

        // Tool 2: estimateShippingRate
        ObjectNode rateTool = funcDecls.addObject();
        rateTool.put("name", "estimateShippingRate");
        rateTool.put("description", "Estimate courier shipping fee in Sri Lankan Rupees (LKR) based on package weight and destination.");
        ObjectNode rateParams = rateTool.putObject("parameters");
        rateParams.put("type", "OBJECT");
        ObjectNode rateProps = rateParams.putObject("properties");
        rateProps.putObject("weightKg").put("type", "NUMBER").put("description", "Weight in kilograms");
        rateProps.putObject("originCity").put("type", "STRING").put("description", "Pickup city (e.g. Colombo)");
        rateProps.putObject("destinationCity").put("type", "STRING").put("description", "Dropoff city (e.g. Kandy, Galle, Jaffna)");
        rateParams.putArray("required").add("weightKg").add("destinationCity");

        return tools;
    }

    private String executeTool(String functionName, JsonNode args) {
        if ("trackParcel".equalsIgnoreCase(functionName)) {
            String trackingNumber = args.path("trackingNumber").asText();
            Optional<PublicTrackingResponse> opt = trackingService.getPublicTracking(trackingNumber);
            if (opt.isPresent()) {
                PublicTrackingResponse p = opt.get();
                return String.format("{\"found\":true,\"trackingNumber\":\"%s\",\"status\":\"%s\",\"origin\":\"%s\",\"destination\":\"%s\",\"latestCity\":\"%s\"}",
                    p.getTrackingNumber(), p.getStatus(), p.getOriginCity(), p.getDestinationCity(),
                    p.getEvents().isEmpty() ? p.getOriginCity() : p.getEvents().get(p.getEvents().size() - 1).getCity());
            }
            return String.format("{\"found\":false,\"trackingNumber\":\"%s\",\"message\":\"Parcel not found\"}", trackingNumber);
        } else if ("estimateShippingRate".equalsIgnoreCase(functionName)) {
            double weight = args.path("weightKg").asDouble(1.0);
            String dest = args.path("destinationCity").asText("Kandy");
            String origin = args.path("originCity").asText("Colombo");
            double fee = calculateLocalFee(weight, origin, dest);
            return String.format("{\"origin\":\"%s\",\"destination\":\"%s\",\"weightKg\":%.2f,\"estimatedFeeLkr\":%.2f}", origin, dest, weight, fee);
        }
        return "{\"error\":\"Unknown tool\"}";
    }

    private AiChatResponse executeLocalFallbackEngine(String prompt, List<String> toolsInvoked) {
        String lower = prompt.toLowerCase();

        // 1. Check for parcel tracking query (e.g., SWIFT-1001-LK, DEMO-ONLY, or "track ...")
        Pattern pattern = Pattern.compile("(?i)(SWIFT-[A-Z0-9-]+|[A-Z0-9]{4,}-[A-Z0-9-]{3,})");
        Matcher matcher = pattern.matcher(prompt);
        if (matcher.find()) {
            String trackingNumber = matcher.group(1).toUpperCase();
            toolsInvoked.add("trackParcel");
            Optional<PublicTrackingResponse> opt = trackingService.getPublicTracking(trackingNumber);
            if (opt.isPresent()) {
                PublicTrackingResponse p = opt.get();
                String lastEvent = p.getEvents().isEmpty() ? "No events recorded yet" :
                    String.format("%s at %s (%s)", 
                        p.getEvents().get(p.getEvents().size() - 1).getStatus(),
                        p.getEvents().get(p.getEvents().size() - 1).getCity(),
                        DateTimeFormatter.ISO_INSTANT.format(p.getEvents().get(p.getEvents().size() - 1).getTimestamp()));

                String reply = String.format(
                    "📦 **Tracking Details for %s**\n\n" +
                    "- **Current Status:** `%s`\n" +
                    "- **Route:** %s ➔ %s\n" +
                    "- **Weight:** %.1f kg\n" +
                    "- **Latest Update:** %s\n\n" +
                    "You can view the full live timeline on our tracking page anytime!",
                    p.getTrackingNumber(), p.getStatus(), p.getOriginCity(), p.getDestinationCity(),
                    p.getWeightKg() != null ? p.getWeightKg() : 1.0, lastEvent
                );
                return AiChatResponse.of(reply, toolsInvoked);
            } else {
                return AiChatResponse.of(
                    String.format("🔍 I searched our system, but could not find a parcel matching **%s**. Please double-check your tracking reference (e.g. `SWIFT-1001-LK`) and try again.", trackingNumber),
                    toolsInvoked
                );
            }
        }

        // 2. Check for fee estimation query
        if (lower.contains("cost") || lower.contains("fee") || lower.contains("price") || lower.contains("how much") || lower.contains("rate")) {
            toolsInvoked.add("estimateShippingRate");
            double weight = 1.0;
            Pattern weightPat = Pattern.compile("(\\d+(\\.\\d+)?)\\s*(kg|kilos|kilograms)");
            Matcher wMatcher = weightPat.matcher(lower);
            if (wMatcher.find()) {
                weight = Double.parseDouble(wMatcher.group(1));
            }

            String dest = "Kandy";
            if (lower.contains("colombo")) dest = "Colombo";
            else if (lower.contains("galle")) dest = "Galle";
            else if (lower.contains("jaffna")) dest = "Jaffna";
            else if (lower.contains("negombo")) dest = "Negombo";

            double fee = calculateLocalFee(weight, "Colombo", dest);
            String reply = String.format(
                "💰 **Delivery Fee Estimate**\n\n" +
                "- **Weight:** %.1f kg\n" +
                "- **Destination:** %s\n" +
                "- **Estimated Fee:** **LKR %.2f**\n\n" +
                "*(Calculated as LKR 350 base rate + LKR 120/kg standard rate). Need to book a pickup? Head over to the Book Delivery page!*",
                weight, dest, fee
            );
            return AiChatResponse.of(reply, toolsInvoked);
        }

        // 3. General greeting or help query
        if (lower.contains("hello") || lower.contains("hi") || lower.contains("hey")) {
            return AiChatResponse.of(
                "👋 Hello! I am **SwiftDrop AI**, your real-time delivery assistant.\n\n" +
                "How can I help you today? You can ask me:\n" +
                "- 📦 *\"Where is my parcel SWIFT-1001-LK?\"*\n" +
                "- 💰 *\"How much to send 2.5 kg to Kandy?\"*\n" +
                "- 🚚 *\"What are your delivery hours?\"*",
                toolsInvoked
            );
        }

        return AiChatResponse.of(
            "I'm here to help with SwiftDrop parcel tracking and rate inquiries! " +
            "You can provide a tracking code like `SWIFT-1001-LK` to check status, or ask for a delivery price estimate.",
            toolsInvoked
        );
    }

    private double calculateLocalFee(double weightKg, String origin, String destination) {
        double baseRate = 350.0;
        double perKgRate = 120.0;
        double weightFee = Math.max(0, weightKg - 1.0) * perKgRate;
        double zoneMultiplier = destination.equalsIgnoreCase("Jaffna") ? 1.4 : 1.0;
        return (baseRate + weightFee) * zoneMultiplier;
    }
}
