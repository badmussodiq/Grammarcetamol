package com.grammarcetamol.review.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record UpdateReviewRequest(@Min(1) @Max(5) Integer rating, String title, String comment) {
}
