package com.swiftdrop.auth.repository;

import com.swiftdrop.auth.entity.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    Optional<User> findByGoogleSubject(String subject);
    boolean existsByEmail(String email);
}
