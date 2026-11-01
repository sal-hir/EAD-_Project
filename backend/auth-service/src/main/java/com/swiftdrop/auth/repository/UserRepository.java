package com.swiftdrop.auth.repository;

import com.swiftdrop.auth.entity.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select u from User u where u.id = :id")
    Optional<User> lockById(@org.springframework.data.repository.query.Param("id") UUID id);
    boolean existsByRole(com.swiftdrop.auth.entity.Role role);
    org.springframework.data.domain.Page<User> findByEmailContainingIgnoreCaseOrNameContainingIgnoreCase(
        String email, String name, org.springframework.data.domain.Pageable pageable);
    Optional<User> findByEmail(String email);
    Optional<User> findByGoogleSubject(String subject);
    boolean existsByEmail(String email);
}
