package com.swiftdrop.merchant.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class OrderDtos {
    private OrderDtos() {}
    public record Contact(
        @NotBlank @Size(max=120) String name,
        @NotBlank @Pattern(regexp="(?=(?:[^0-9]*[0-9]){7,15}[^0-9]*$)[+0-9() -]{7,30}") String phone,
        @NotBlank @Size(max=500) String address,
        @NotBlank @Size(max=120) String district) {}
    public record Parcel(
        @NotBlank @Size(max=500) String description,
        @NotNull @DecimalMin("0.001") @DecimalMax("1000") @Digits(integer=4,fraction=3) BigDecimal weightKg,
        @NotNull @DecimalMin("0.1") @DecimalMax("500") @Digits(integer=3,fraction=1) BigDecimal lengthCm,
        @NotNull @DecimalMin("0.1") @DecimalMax("500") @Digits(integer=3,fraction=1) BigDecimal widthCm,
        @NotNull @DecimalMin("0.1") @DecimalMax("500") @Digits(integer=3,fraction=1) BigDecimal heightCm) {}
    public record Create(
        @NotBlank @Pattern(regexp="[A-Za-z0-9][A-Za-z0-9._-]{0,99}") String merchantOrderId,
        @NotNull @Valid Contact pickup,
        @NotNull @Valid Contact recipient,
        @NotNull @Valid Parcel parcel,
        @NotBlank @Pattern(regexp="STANDARD|EXPRESS") String serviceType,
        @Size(max=1000) String notes) {}
    public record Order(UUID id, UUID merchantId, String merchantOrderId, String status,
                        UUID parcelId, String trackingNumber, Instant createdAt, Create request) {}
    public record Created(Order order, boolean replay) {}
    public record Page(List<Order> orders, int page, int size, long total) {}
    public record TrackingEvent(String status, Instant occurredAt, String description) {}
    public record Tracking(UUID orderId, String merchantOrderId, String status,
                           UUID parcelId, String trackingNumber, boolean trackingAvailable,
                           Instant updatedAt, List<TrackingEvent> events, String message) {}
}
