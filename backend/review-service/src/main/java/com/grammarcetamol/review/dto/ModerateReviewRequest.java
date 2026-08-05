package com.grammarcetamol.review.dto;

import jakarta.validation.constraints.NotBlank;

public record ModerateReviewRequest(@NotBlank String status, String note) {
}
