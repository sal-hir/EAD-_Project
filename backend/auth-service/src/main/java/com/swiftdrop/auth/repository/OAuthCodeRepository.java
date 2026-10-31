package com.swiftdrop.auth.repository;

import com.swiftdrop.auth.entity.OAuthCode;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface OAuthCodeRepository extends JpaRepository<OAuthCode, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from OAuthCode c where c.codeHash = :hash")
    Optional<OAuthCode> lockByHash(@Param("hash") String hash);
    long deleteByExpiresAtBefore(Instant now);
}
