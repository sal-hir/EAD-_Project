package com.swiftdrop.courier.dto;

import java.util.List;

public record CourierDeliveriesResponse(
    CourierProfileDto courier,
    List<ParcelDto> parcels
) {}

