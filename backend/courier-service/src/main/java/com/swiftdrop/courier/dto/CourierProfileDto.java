package com.swiftdrop.courier.dto;

import com.swiftdrop.courier.entity.Courier;
import java.util.UUID;

public record CourierProfileDto(
    UUID id,
    UUID userId,
    String name,
    String phone,
    String vehicleType,
    String licenseNo,
    boolean isAvailable,
    String zone
) {
    public static CourierProfileDto fromEntity(Courier c) {
        return new CourierProfileDto(
            c.getId(),
            c.getUserId(),
            c.getName(),
            c.getPhone(),
            c.getVehicleType(),
            c.getLicenseNo(),
            c.isAvailable(),
            c.getZone()
        );
    }
}

