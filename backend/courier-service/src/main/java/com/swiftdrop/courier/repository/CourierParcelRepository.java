package com.swiftdrop.courier.repository;

import com.swiftdrop.courier.entity.CourierParcel;
import com.swiftdrop.courier.entity.DeliveryStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CourierParcelRepository extends JpaRepository<CourierParcel, UUID> {
    List<CourierParcel> findByCourierIdOrderByCreatedAtDesc(UUID courierId);
    List<CourierParcel> findByCourierIdAndStatusOrderByCreatedAtDesc(UUID courierId, DeliveryStatus status);
    Optional<CourierParcel> findByTrackingNumber(String trackingNumber);
}

