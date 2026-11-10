package com.swiftdrop.courier.entity;

import java.util.Set;

public enum DeliveryStatus {
    PENDING_PICKUP,
    PICKED_UP,
    IN_TRANSIT,
    OUT_FOR_DELIVERY,
    DELIVERED,
    FAILED,
    CANCELLED;

    public static boolean isValidTransition(DeliveryStatus current, DeliveryStatus next) {
        if (current == null || next == null) return false;
        if (current == next) return true; // idempotent

        return switch (current) {
            case PENDING_PICKUP -> Set.of(PICKED_UP, FAILED, CANCELLED).contains(next);
            case PICKED_UP -> Set.of(IN_TRANSIT, FAILED, CANCELLED).contains(next);
            case IN_TRANSIT -> Set.of(OUT_FOR_DELIVERY, FAILED, CANCELLED).contains(next);
            case OUT_FOR_DELIVERY -> Set.of(DELIVERED, FAILED, CANCELLED).contains(next);
            case FAILED -> Set.of(OUT_FOR_DELIVERY, IN_TRANSIT, CANCELLED).contains(next);
            case DELIVERED, CANCELLED -> false; // Terminal states
        };
    }
}

