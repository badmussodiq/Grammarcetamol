package com.grammarcetamol.course.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
public class CreateCourseRequest {

    @NotBlank(message = "Title is required")
    private String title;

    private String subtitle;

    @NotBlank(message = "Description is required")
    private String description;

    private List<String> learningObjectives;

    private String targetAudience;

    private String prerequisites;

    private UUID categoryId;

    @NotBlank(message = "Difficulty is required")
    @Pattern(regexp = "beginner|intermediate|advanced", message = "Difficulty must be beginner, intermediate, or advanced")
    private String difficulty;

    private String language = "en";

    private Integer estimatedDuration;

    @NotNull(message = "Price is required")
    private BigDecimal price;

    private BigDecimal discountPrice;

    private Instant discountExpiresAt;

    private String currency = "USD";

    private String coverImageUrl;

    private String promoVideoUrl;

    @NotBlank(message = "Instructor name is required")
    private String instructorName;

    private String instructorBio;

    private String instructorAvatarUrl;
}
