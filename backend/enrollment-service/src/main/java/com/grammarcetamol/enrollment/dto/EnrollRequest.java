package com.grammarcetamol.enrollment.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record EnrollRequest(@NotNull UUID courseId) {
}
