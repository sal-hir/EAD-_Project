package com.swiftdrop.merchant.dto;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;

public final class WebhookDtos {
    private WebhookDtos() {}
    public record Update(@NotBlank @Size(max=2000) String url,@NotNull Boolean enabled) {}
    public record Settings(String url,boolean enabled,boolean configured,Instant updatedAt) {}
    public record Saved(Settings settings,String signingSecret) {
        @Override public String toString() { return "WebhookSettings[secret redacted]"; }
    }
    public record Delivery(UUID id,String eventType,String state,int attempts,Instant nextAttemptAt,Instant createdAt,Instant updatedAt) {}
    public record Attempt(int attemptNumber,Integer responseStatus,String outcome,Instant createdAt) {}
    public record Detail(Delivery delivery,List<Attempt> attempts) {}
    public record Page(List<Delivery> deliveries,int page,int size,long total) {}
}
