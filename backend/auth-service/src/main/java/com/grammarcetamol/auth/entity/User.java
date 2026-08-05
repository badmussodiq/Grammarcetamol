package com.grammarcetamol.auth.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@Data
@NoArgsConstructor
@Entity
@Table(name = "users")
public class User {

    // -----------------------------------------------------------------------
    // Account status
    // -----------------------------------------------------------------------

    public enum Status {
        PENDING_VERIFICATION, ACTIVE, SUSPENDED, DELETED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @JsonIgnore
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "user_status")
    private Status status = Status.PENDING_VERIFICATION;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = false;

    @Column(name = "failed_attempts", nullable = false)
    private int failedAttempts = 0;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    // -----------------------------------------------------------------------
    // Role — stored as enum name string, no separate table
    // -----------------------------------------------------------------------

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 64)
    private RoleName role = RoleName.STUDENT;

    // -----------------------------------------------------------------------
    // Profile fields (previously in user_profiles table)
    // -----------------------------------------------------------------------

    @Column(name = "full_name", length = 255)
    private String fullName;

    @Column(length = 30)
    private String phone;

    @Column(name = "avatar_url", length = 512)
    private String avatarUrl;

    @Column(length = 100)
    private String country;

    @Column(length = 100)
    private String timezone;

    @Column(columnDefinition = "TEXT")
    private String bio;

    @Column(name = "learning_goals", columnDefinition = "TEXT[]")
    private String[] learningGoals;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "JSONB")
    private Map<String, Object> preferences;

    // -----------------------------------------------------------------------
    // Timestamps
    // -----------------------------------------------------------------------

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}
