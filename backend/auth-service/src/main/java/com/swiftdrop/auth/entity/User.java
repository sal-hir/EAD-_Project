package com.swiftdrop.auth.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {
    @Id private UUID id;
    @Column(nullable = false, length = 120) private String name;
    @Column(nullable = false, unique = true, length = 254) private String email;
    @Column(name = "password_hash", length = 100) private String passwordHash;
    @Column(length = 30) private String phone;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Role role;
    @Column(nullable = false) private boolean active = true;
    @Column(name = "google_subject", unique = true) private String googleSubject;
    @Column(nullable = false, updatable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;
    protected User() {}
    public User(String name, String email, String passwordHash, String phone) {
        this.id = UUID.randomUUID(); this.name = name; this.email = email;
        this.passwordHash = passwordHash; this.phone = phone; this.role = Role.CUSTOMER;
    }
    @PrePersist void created() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void updated() { updatedAt = Instant.now(); }
    public UUID getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getPhone() { return phone; }
    public Role getRole() { return role; }
    public boolean isActive() { return active; }
    public String getGoogleSubject() { return googleSubject; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setGoogleSubject(String subject) { googleSubject = subject; }
    public void setActive(boolean active) { this.active = active; }
    public void setRole(Role role) { this.role = role; }
}
