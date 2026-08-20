package com.grammarcetamol.enrollment.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.UUID;

public record EnrolledUserIdsRequest(@NotEmpty List<UUID> courseIds) {
}
