package com.grammarcetamol.review.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateReviewRequest(@NotNull UUID courseId, @Min(1) @Max(5) int rating,
                                   String title, String comment) {
}
