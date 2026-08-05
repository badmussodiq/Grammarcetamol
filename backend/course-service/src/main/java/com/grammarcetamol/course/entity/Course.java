package com.grammarcetamol.course.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@Entity
@Table(name = "courses")
public class Course {

    // status values: draft, review, published, archived
    public static final String STATUS_DRAFT = "draft";
    public static final String STATUS_REVIEW = "review";
    public static final String STATUS_PUBLISHED = "published";
    public static final String STATUS_ARCHIVED = "archived";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false, unique = true, length = 280)
    private String slug;

    @Column(name = "instructor_id", nullable = false)
    private UUID instructorId;

    @Column(name = "instructor_name", nullable = false)
    private String instructorName;

    @Column(name = "instructor_bio", columnDefinition = "TEXT")
    private String instructorBio;

    @Column(name = "instructor_avatar_url", length = 500)
    private String instructorAvatarUrl;

    @Column(nullable = false)
    private String title;

    @Column(length = 500)
    private String subtitle;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "learning_objectives", columnDefinition = "TEXT[]")
    private String[] learningObjectives = new String[0];

    @Column(name = "target_audience", columnDefinition = "TEXT")
    private String targetAudience;

    @Column(columnDefinition = "TEXT")
    private String prerequisites;

    @Column(name = "category_id")
    private UUID categoryId;

    @Column(nullable = false, length = 20)
    private String difficulty;

    @Column(nullable = false, length = 10)
    private String language = "en";

    @Column(name = "estimated_duration")
    private Integer estimatedDuration;

    @Column(nullable = false, length = 20)
    private String status = STATUS_DRAFT;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price = BigDecimal.ZERO;

    @Column(name = "discount_price", precision = 10, scale = 2)
    private BigDecimal discountPrice;

    @Column(name = "discount_expires_at")
    private Instant discountExpiresAt;

    @Column(nullable = false, length = 3)
    private String currency = "USD";

    @Column(name = "cover_image_url", length = 500)
    private String coverImageUrl;

    @Column(name = "promo_video_url", length = 500)
    private String promoVideoUrl;

    @Column(name = "enrollment_count", nullable = false)
    private int enrollmentCount = 0;

    @Column(name = "avg_rating", precision = 2, scale = 1)
    private BigDecimal avgRating;

    @Column(name = "review_count", nullable = false)
    private int reviewCount = 0;

    @Column(nullable = false)
    private int version = 1;

    @Column(name = "published_at")
    private Instant publishedAt;

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
