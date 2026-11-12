package com.swiftdrop.tracking.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public class AiChatRequest {

    @NotBlank(message = "Message prompt cannot be empty")
    private String message;

    private List<ChatMessage> history;

    public AiChatRequest() {}

    public AiChatRequest(String message, List<ChatMessage> history) {
        this.message = message;
        this.history = history;
    }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public List<ChatMessage> getHistory() { return history; }
    public void setHistory(List<ChatMessage> history) { this.history = history; }

    public static class ChatMessage {
        private String role; // "user" or "model"
        private String text;

        public ChatMessage() {}
        public ChatMessage(String role, String text) {
            this.role = role;
            this.text = text;
        }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
        public String getText() { return text; }
        public void setText(String text) { this.text = text; }
    }
}
