package com.grammarcetamol.course.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@Entity
@Table(name = "lessons")
public class Lesson {

    public static final String TYPE_VIDEO = "video";
    public static final String TYPE_TEXT = "text";
    public static final String TYPE_QUIZ = "quiz";
    public static final String TYPE_RESOURCE = "resource";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "module_id", nullable = false)
    private UUID moduleId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 20)
    private String type = TYPE_VIDEO;

    private Integer duration;

    @Column(nullable = false)
    private int position = 0;

    @Column(name = "video_url", length = 500)
    private String videoUrl;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "video_metadata", columnDefinition = "JSONB")
    private String videoMetadata;

    @Column(name = "is_preview", nullable = false)
    private boolean preview = false;

    @Column(name = "is_published", nullable = false)
    private boolean published = true;

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
