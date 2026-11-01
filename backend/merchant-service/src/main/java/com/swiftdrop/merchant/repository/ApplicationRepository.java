package com.swiftdrop.merchant.repository;

import com.swiftdrop.merchant.entity.Application;
import com.swiftdrop.merchant.dto.MerchantDtos.Status;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ApplicationRepository extends JpaRepository<Application,UUID> {
    Optional<Application> findByUserId(UUID userId);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select a from Application a where a.id=:id") Optional<Application> lockById(@Param("id") UUID id);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select a from Application a where a.userId=:id") Optional<Application> lockByOwner(@Param("id") UUID id);
    @Query("select a from Application a where (:status is null or a.status=:status) and (lower(a.details.businessName) like lower(concat('%',:search,'%')) or lower(a.details.businessEmail) like lower(concat('%',:search,'%')))")
    Page<Application> search(@Param("status") Status status,@Param("search") String search,Pageable pageable);
}
