package com.grammarcetamol.enrollment.dto;

/** Used by Review Service to check the 50%-completion gate before accepting a review. */
public record CompletionResponse(boolean enrolled, int completionPct) {
}
