package com.grammarcetamol.review.exception;

import com.grammarcetamol.shared.dto.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Review-domain exception mappings only — common mappings (validation, EntityNotFoundException,
 * ForbiddenException, IllegalArgumentException, the RuntimeException catch-all) live in
 * shared-java's GlobalExceptionHandler. See course-service's CourseExceptionHandler for why this
 * composes cleanly without inheritance. */
@RestControllerAdvice
public class ReviewExceptionHandler {

    @ExceptionHandler(ReviewAlreadyExistsException.class)
    public ResponseEntity<ApiResponse<Object>> handleAlreadyExists(ReviewAlreadyExistsException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error(ex.getMessage()));
    }
}
