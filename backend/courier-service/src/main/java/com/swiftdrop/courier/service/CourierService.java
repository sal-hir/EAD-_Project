package com.swiftdrop.courier.service;

import com.swiftdrop.courier.client.IdentityGateway;
import com.swiftdrop.courier.dto.*;
import com.swiftdrop.courier.entity.*;
import com.swiftdrop.courier.exception.ApiFailure;
import com.swiftdrop.courier.repository.CourierParcelRepository;
import com.swiftdrop.courier.repository.CourierRepository;
import com.swiftdrop.courier.repository.ParcelStatusHistoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class CourierService {
    private final CourierRepository courierRepository;
    private final CourierParcelRepository parcelRepository;
    private final ParcelStatusHistoryRepository historyRepository;

    public CourierService(CourierRepository courierRepository,
                          CourierParcelRepository parcelRepository,
                          ParcelStatusHistoryRepository historyRepository) {
        this.courierRepository = courierRepository;
        this.parcelRepository = parcelRepository;
        this.historyRepository = historyRepository;
    }

    @Transactional
    public Courier getOrCreateCourier(IdentityGateway.Caller caller) {
        return courierRepository.findByUserId(caller.id()).orElseGet(() -> {
            Courier c = new Courier();
            c.setUserId(caller.id());
            c.setName(caller.name() != null ? caller.name() : "Courier");
            c.setPhone(caller.phone() != null ? caller.phone() : "");
            c.setVehicleType("MOTORCYCLE");
            c.setLicenseNo("DEFAULT-LIC");
            c.setZone("WESTERN_PROVINCE");
            c.setAvailable(true);
            return courierRepository.save(c);
        });
    }

    @Transactional(readOnly = true)
    public CourierDeliveriesResponse getMyDeliveries(IdentityGateway.Caller caller, DeliveryStatus statusFilter) {
        Courier courier = getOrCreateCourier(caller);
        List<CourierParcel> parcels = (statusFilter != null)
            ? parcelRepository.findByCourierIdAndStatusOrderByCreatedAtDesc(courier.getId(), statusFilter)
            : parcelRepository.findByCourierIdOrderByCreatedAtDesc(courier.getId());

        List<ParcelDto> parcelDtos = parcels.stream().map(ParcelDto::fromEntity).toList();
        return new CourierDeliveriesResponse(CourierProfileDto.fromEntity(courier), parcelDtos);
    }

    @Transactional
    public CourierProfileDto setAvailability(IdentityGateway.Caller caller, boolean isAvailable) {
        Courier courier = getOrCreateCourier(caller);
        courier.setAvailable(isAvailable);
        courier = courierRepository.save(courier);
        return CourierProfileDto.fromEntity(courier);
    }

    @Transactional
    public ParcelDto updateParcelStatus(IdentityGateway.Caller caller, UUID parcelId, StatusUpdateRequest req) {
        Courier courier = getOrCreateCourier(caller);
        CourierParcel parcel = parcelRepository.findById(parcelId)
            .orElseThrow(() -> new ApiFailure(404, "Parcel not found"));

        // Courier Isolation Guard: A courier cannot view or update another courier's parcel
        boolean isAdmin = "ADMIN".equalsIgnoreCase(caller.role()) || "DISPATCHER".equalsIgnoreCase(caller.role());
        if (!isAdmin && (parcel.getCourierId() == null || !parcel.getCourierId().equals(courier.getId()))) {
            throw new ApiFailure(403, "Access denied: This parcel is not assigned to you");
        }

        // State Machine validation
        if (!DeliveryStatus.isValidTransition(parcel.getStatus(), req.status())) {
            throw new ApiFailure(400, "Invalid status transition from " + parcel.getStatus() + " to " + req.status());
        }

        // Failure reason is mandatory when status is FAILED
        if (req.status() == DeliveryStatus.FAILED) {
            if (req.failureReason() == null || req.failureReason().trim().isEmpty()) {
                throw new ApiFailure(400, "A failure reason is mandatory when marking a delivery as FAILED");
            }
            parcel.setFailureReason(req.failureReason().trim());
        }

        if (req.note() != null) {
            parcel.setNote(req.note().trim());
        }

        if (req.proofImageUrl() != null && !req.proofImageUrl().trim().isEmpty()) {
            parcel.setProofImageUrl(req.proofImageUrl().trim());
        }

        if (req.status() == DeliveryStatus.DELIVERED) {
            parcel.setDeliveredAt(OffsetDateTime.now());
        }

        parcel.setStatus(req.status());
        parcel = parcelRepository.save(parcel);

        // Record status history audit
        ParcelStatusHistory history = new ParcelStatusHistory();
        history.setParcelId(parcel.getId());
        history.setStatus(req.status());
        history.setNote(req.note());
        history.setProofImageUrl(req.proofImageUrl());
        history.setFailureReason(req.failureReason());
        history.setUpdatedBy(caller.id());
        historyRepository.save(history);

        return ParcelDto.fromEntity(parcel);
    }
}

