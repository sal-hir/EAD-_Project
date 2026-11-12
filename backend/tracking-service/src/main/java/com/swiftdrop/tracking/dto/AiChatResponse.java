package com.swiftdrop.tracking.dto;

import java.util.List;

public class AiChatResponse {
    private boolean success;
    private String reply;
    private List<String> toolsInvoked;

    public AiChatResponse() {}

    public AiChatResponse(boolean success, String reply, List<String> toolsInvoked) {
        this.success = success;
        this.reply = reply;
        this.toolsInvoked = toolsInvoked;
    }

    public static AiChatResponse of(String reply, List<String> toolsInvoked) {
        return new AiChatResponse(true, reply, toolsInvoked);
    }

    public static AiChatResponse error(String message) {
        return new AiChatResponse(false, message, List.of());
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getReply() { return reply; }
    public void setReply(String reply) { this.reply = reply; }

    public List<String> getToolsInvoked() { return toolsInvoked; }
    public void setToolsInvoked(List<String> toolsInvoked) { this.toolsInvoked = toolsInvoked; }
}
