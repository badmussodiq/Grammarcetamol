package com.grammarcetamol.review.client;

import java.util.UUID;

/** Local mirror of enrollment-service's CompletionResponse JSON shape. */
public record CompletionDto(boolean enrolled, int completionPct, UUID enrollmentId) {
}
