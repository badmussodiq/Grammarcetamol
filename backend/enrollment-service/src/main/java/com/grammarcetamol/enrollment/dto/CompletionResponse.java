package com.grammarcetamol.enrollment.dto;

import java.util.UUID;

/** Used by Review Service to check the 50%-completion gate before accepting a review, and to get
 * the enrollment's own id to stamp onto the review row (review_db.reviews.enrollment_id). */
public record CompletionResponse(boolean enrolled, int completionPct, UUID enrollmentId) {
}
