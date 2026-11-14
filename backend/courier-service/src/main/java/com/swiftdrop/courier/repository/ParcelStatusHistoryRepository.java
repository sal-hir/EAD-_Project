package com.swiftdrop.courier.repository;

import com.swiftdrop.courier.entity.ParcelStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ParcelStatusHistoryRepository extends JpaRepository<ParcelStatusHistory, UUID> {
    List<ParcelStatusHistory> findByParcelIdOrderByTimestampDesc(UUID parcelId);
}

