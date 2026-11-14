package com.swiftdrop.tracking.repository;

import com.swiftdrop.tracking.entity.TrackingParcel;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface TrackingParcelRepository extends JpaRepository<TrackingParcel, UUID> {
    
    @EntityGraph(attributePaths = {"events"})
    Optional<TrackingParcel> findByTrackingNumber(String trackingNumber);

    boolean existsByTrackingNumber(String trackingNumber);
}
