package com.grammarcetamol.course.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Every field is optional — only supplied (non-null) fields are patched onto the course. */
@Data
public class UpdateCourseRequest {
    private String title;
    private String subtitle;
    private String description;
    private List<String> learningObjectives;
    private String targetAudience;
    private String prerequisites;
    private UUID categoryId;
    private String difficulty;
    private String language;
    private Integer estimatedDuration;
    private BigDecimal price;
    private BigDecimal discountPrice;
    private Instant discountExpiresAt;
    private String currency;
    private String coverImageUrl;
    private String promoVideoUrl;
    private String instructorName;
    private String instructorBio;
    private String instructorAvatarUrl;
}
