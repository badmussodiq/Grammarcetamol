package com.grammarcetamol.enrollment.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record ProgressUpdateRequest(@NotNull UUID courseId, @NotNull UUID lessonId,
                                     Integer currentTime, Boolean completed) {
}
