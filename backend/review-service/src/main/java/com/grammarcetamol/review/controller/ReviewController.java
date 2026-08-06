package com.grammarcetamol.review.controller;

import com.grammarcetamol.review.dto.CreateReviewRequest;
import com.grammarcetamol.review.dto.ModerateReviewRequest;
import com.grammarcetamol.review.dto.UpdateReviewRequest;
import com.grammarcetamol.review.entity.Review;
import com.grammarcetamol.review.service.ReviewService;
import com.grammarcetamol.shared.config.CurrentUser;
import com.grammarcetamol.shared.dto.ApiResponse;
import com.grammarcetamol.shared.exception.ForbiddenException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @PostMapping("/api/reviews")
    public ResponseEntity<ApiResponse<Review>> create(@Valid @RequestBody CreateReviewRequest request,
                                                        CurrentUser currentUser) {
        requireAuthenticated(currentUser);
        Review review = reviewService.create(currentUser.id(), request.courseId(), request.rating(),
            request.title(), request.comment());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(review));
    }

    @PatchMapping("/api/reviews/{id}")
    public ApiResponse<Review> update(@PathVariable UUID id, @Valid @RequestBody UpdateReviewRequest request,
                                       CurrentUser currentUser) {
        requireAuthenticated(currentUser);
        Review review = reviewService.update(id, currentUser.id(), request.rating(), request.title(), request.comment());
        return ApiResponse.success(review);
    }

    /** The current student's own review for a course, or null if they haven't reviewed it yet —
     * lets the student frontend decide between a create form and an edit form. */
    @GetMapping("/api/reviews/mine")
    public ApiResponse<Review> mine(@RequestParam UUID courseId, CurrentUser currentUser) {
        requireAuthenticated(currentUser);
        return ApiResponse.success(reviewService.getMyReview(currentUser.id(), courseId));
    }

    @GetMapping("/api/courses/{courseId}/reviews")
    public ApiResponse<Map<String, Object>> courseReviews(@PathVariable UUID courseId,
                                                            @RequestParam(defaultValue = "1") int page,
                                                            @RequestParam(defaultValue = "20") int limit) {
        Page<Review> result = reviewService.getCourseReviews(courseId, page, limit);
        return ApiResponse.success(pageBody(result));
    }

    @GetMapping("/api/reviews")
    public ApiResponse<Map<String, Object>> adminList(@RequestParam(required = false) String status,
                                                        @RequestParam(required = false) UUID courseId,
                                                        @RequestParam(required = false) Integer rating,
                                                        @RequestParam(defaultValue = "1") int page,
                                                        @RequestParam(defaultValue = "20") int limit,
                                                        CurrentUser currentUser) {
        requireAdminOrModerator(currentUser);
        Page<Review> result = reviewService.adminSearch(status, courseId, rating, page, limit);
        return ApiResponse.success(pageBody(result));
    }

    @GetMapping("/api/reviews/{id}")
    public ApiResponse<Review> getById(@PathVariable UUID id, CurrentUser currentUser) {
        requireAdminOrModerator(currentUser);
        return ApiResponse.success(reviewService.getById(id));
    }

    @PatchMapping("/api/reviews/{id}/moderate")
    public ApiResponse<Review> moderate(@PathVariable UUID id, @Valid @RequestBody ModerateReviewRequest request,
                                         CurrentUser currentUser) {
        requireAdminOrModerator(currentUser);
        Review review = reviewService.moderate(id, currentUser.id(), request.status(), request.note());
        return ApiResponse.success(review);
    }

    private void requireAuthenticated(CurrentUser currentUser) {
        if (!currentUser.isAuthenticated()) {
            throw new ForbiddenException("Authentication required");
        }
    }

    private void requireAdminOrModerator(CurrentUser currentUser) {
        if (!currentUser.isAdminOrModerator()) {
            throw new ForbiddenException("Only super admins or moderators can perform this action");
        }
    }

    private Map<String, Object> pageBody(Page<Review> result) {
        return Map.of(
            "items", result.getContent(),
            "page", result.getNumber() + 1,
            "limit", result.getSize(),
            "total", result.getTotalElements(),
            "totalPages", result.getTotalPages()
        );
    }
}
