package com.grammarcetamol.enrollment.dto;

import java.time.Instant;
import java.util.UUID;

public record AtRiskEnrollmentResponse(UUID enrollmentId, UUID userId, UUID courseId,
                                        int completionPct, Instant enrolledAt) {
}
