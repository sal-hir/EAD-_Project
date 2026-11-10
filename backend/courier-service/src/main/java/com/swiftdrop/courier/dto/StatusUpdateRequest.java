package com.swiftdrop.courier.dto;

import com.swiftdrop.courier.entity.DeliveryStatus;
import jakarta.validation.constraints.NotNull;

public record StatusUpdateRequest(
    @NotNull(message = "status is required")
    DeliveryStatus status,
    String note,
    String proofImageUrl,
    String failureReason
) {}

