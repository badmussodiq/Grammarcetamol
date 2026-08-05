package com.grammarcetamol.course.exception;

import com.grammarcetamol.shared.dto.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Course-domain exception mappings only. Common mappings (validation, EntityNotFoundException,
 * ForbiddenException, IllegalArgumentException, the RuntimeException catch-all) live in
 * shared-java's GlobalExceptionHandler — Spring resolves the most specific handler across all
 * advice beans, so these more-specific RuntimeException subtypes are matched here instead of the
 * shared catch-all without any inheritance between the two classes.
 */
@RestControllerAdvice
public class CourseExceptionHandler {

    @ExceptionHandler(CoursePublishValidationException.class)
    public ResponseEntity<ApiResponse<Object>> handlePublishValidation(CoursePublishValidationException ex) {
        return ResponseEntity.badRequest().body(ApiResponse.error(ex.getMessage(), ex.getErrors()));
    }

    @ExceptionHandler(CourseDeletionBlockedException.class)
    public ResponseEntity<ApiResponse<Object>> handleDeletionBlocked(CourseDeletionBlockedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error(ex.getMessage()));
    }
}
