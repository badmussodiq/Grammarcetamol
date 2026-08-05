package com.grammarcetamol.enrollment.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@Entity
@Table(name = "lesson_progress")
public class LessonProgress {

    public static final String STATUS_NOT_STARTED = "not_started";
    public static final String STATUS_IN_PROGRESS = "in_progress";
    public static final String STATUS_COMPLETED = "completed";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "enrollment_id", nullable = false)
    private UUID enrollmentId;

    @Column(name = "lesson_id", nullable = false)
    private UUID lessonId;

    @Column(nullable = false, length = 20)
    private String status = STATUS_NOT_STARTED;

    @Column(name = "watch_position", nullable = false)
    private int watchPosition = 0;

    @Column(name = "completion_pct", nullable = false, precision = 5, scale = 2)
    private BigDecimal completionPct = BigDecimal.ZERO;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "last_accessed_at", nullable = false)
    private Instant lastAccessedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        updatedAt = now;
        if (lastAccessedAt == null) {
            lastAccessedAt = now;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}
