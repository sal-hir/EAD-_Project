package com.swiftdrop.auth.repository;

import com.swiftdrop.auth.entity.RefreshSession;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface RefreshSessionRepository extends JpaRepository<RefreshSession, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from RefreshSession s where s.id = :id")
    Optional<RefreshSession> lockById(@Param("id") UUID id);
    @Modifying
    @Query(value = "delete from auth.refresh_sessions where expires_at < :now", nativeQuery = true)
    int deleteExpired(@Param("now") java.time.Instant now);
}
