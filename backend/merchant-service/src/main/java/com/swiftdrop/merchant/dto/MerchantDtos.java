package com.swiftdrop.merchant.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;

public final class MerchantDtos {
    private MerchantDtos(){}
    public enum Status {PENDING,APPROVING,APPROVED,REJECTED}
    public record Business(
        @NotBlank @Size(max=120) String businessName,@Size(max=120) String tradingName,
        @Size(max=80) String registrationNumber,@NotBlank @Size(max=60) String category,
        @NotBlank @Size(max=120) String contactName,@NotBlank @Email @Size(max=254) String businessEmail,
        @NotBlank @Size(min=7,max=30) @Pattern(regexp="[+0-9 ()-]+") String phone,
        @NotBlank @Size(max=500) String address,@NotBlank @Size(max=120) String district,
        @Size(max=300) @Pattern(regexp="(?:https?://[^\\s]+)?",message="must be an http or https URL") String website,
        @Size(max=2000) String additionalDetails){}
    public record Update(@NotNull @Valid Business business,@NotNull @PositiveOrZero Long version){}
    public record Version(@NotNull @PositiveOrZero Long version){}
    public record Rejection(@NotNull @PositiveOrZero Long version,@NotBlank @Size(max=1000) String reason){}
    public record Profile(UUID id,UUID userId,Business business,Status status,long version,Instant submittedAt,Instant createdAt,Instant updatedAt,Instant approvedAt,UUID reviewedBy,String rejectionReason,String syncError){}
    public record PageResult(List<Profile> applications,int page,int pages,long total){}
    public record Audit(UUID id,UUID applicationId,UUID actorId,String action,String detail,Instant createdAt){}
    public record Envelope<T>(boolean success,T data){public static <T> Envelope<T> ok(T data){return new Envelope<>(true,data);}}
}
