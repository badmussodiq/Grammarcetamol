package com.grammarcetamol.review.service;

import com.grammarcetamol.review.client.CompletionDto;
import com.grammarcetamol.review.client.EnrollmentServiceClient;
import com.grammarcetamol.review.config.AppProperties;
import com.grammarcetamol.review.entity.Review;
import com.grammarcetamol.review.exception.ReviewAlreadyExistsException;
import com.grammarcetamol.review.messaging.ReviewEventPublisher;
import com.grammarcetamol.review.repository.ReviewRepository;
import com.grammarcetamol.shared.exception.ForbiddenException;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private static final Set<String> VALID_STATUSES = Set.of(
        Review.STATUS_PENDING, Review.STATUS_APPROVED, Review.STATUS_REJECTED, Review.STATUS_FLAGGED);

    private final ReviewRepository reviewRepository;
    private final EnrollmentServiceClient enrollmentServiceClient;
    private final ReviewEventPublisher eventPublisher;
    private final AppProperties appProperties;

    @Transactional
    public Review create(UUID userId, UUID courseId, int rating, String title, String comment) {
        if (reviewRepository.findByUserIdAndCourseId(userId, courseId).isPresent()) {
            throw new ReviewAlreadyExistsException(
                "You've already reviewed this course — edit your existing review instead of submitting a new one");
        }

        CompletionDto completion = enrollmentServiceClient.getCompletion(userId, courseId);
        if (!completion.enrolled()) {
            throw new ForbiddenException("You must be enrolled in this course to leave a review");
        }
        int threshold = appProperties.getReviewCompletionThresholdPct();
        if (completion.completionPct() < threshold) {
            throw new ForbiddenException(
                "You must complete at least " + threshold + "% of the course before leaving a review "
                    + "(you're currently at " + completion.completionPct() + "%)");
        }

        Review review = new Review();
        review.setUserId(userId);
        review.setCourseId(courseId);
        review.setEnrollmentId(completion.enrollmentId());
        review.setRating(rating);
        review.setTitle(title);
        review.setComment(comment);
        Review saved = reviewRepository.save(review);

        eventPublisher.publishReviewSubmitted(saved);
        return saved;
    }

    @Transactional
    public Review update(UUID reviewId, UUID userId, Integer rating, String title, String comment) {
        Review review = reviewRepository.findById(reviewId)
            .orElseThrow(() -> new EntityNotFoundException("Review not found: " + reviewId));

        if (!review.getUserId().equals(userId)) {
            throw new ForbiddenException("You can only edit your own review");
        }

        int editWindowDays = appProperties.getReviewEditWindowDays();
        if (review.getCreatedAt().isBefore(Instant.now().minus(editWindowDays, ChronoUnit.DAYS))) {
            throw new ForbiddenException("Reviews can only be edited within " + editWindowDays + " days of submission");
        }

        if (rating != null) {
            review.setRating(rating);
        }
        if (title != null) {
            review.setTitle(title);
        }
        if (comment != null) {
            review.setComment(comment);
        }
        review.setEdited(true);
        review.setEditedAt(Instant.now());

        return reviewRepository.save(review);
    }

    public Page<Review> getCourseReviews(UUID courseId, int page, int limit) {
        Pageable pageable = PageRequest.of(Math.max(page - 1, 0), limit, Sort.by(Sort.Direction.DESC, "createdAt"));
        return reviewRepository.findByCourseIdAndStatus(courseId, Review.STATUS_APPROVED, pageable);
    }

    public Page<Review> adminSearch(String status, UUID courseId, Integer rating, int page, int limit) {
        Pageable pageable = PageRequest.of(Math.max(page - 1, 0), limit, Sort.by(Sort.Direction.DESC, "createdAt"));
        return reviewRepository.search(status, courseId, rating, pageable);
    }

    public Review getById(UUID reviewId) {
        return reviewRepository.findById(reviewId)
            .orElseThrow(() -> new EntityNotFoundException("Review not found: " + reviewId));
    }

    /** Null when the student hasn't reviewed this course yet — not an error, the frontend uses
     * this to decide between showing a create form and an edit form. */
    public Review getMyReview(UUID userId, UUID courseId) {
        return reviewRepository.findByUserIdAndCourseId(userId, courseId).orElse(null);
    }

    @Transactional
    public Review moderate(UUID reviewId, UUID moderatorId, String status, String note) {
        if (!VALID_STATUSES.contains(status)) {
            throw new IllegalArgumentException("Invalid status: " + status + " — must be one of " + VALID_STATUSES);
        }

        Review review = reviewRepository.findById(reviewId)
            .orElseThrow(() -> new EntityNotFoundException("Review not found: " + reviewId));

        review.setStatus(status);
        review.setModeratedBy(moderatorId);
        review.setModeratedAt(Instant.now());
        review.setModerationNote(note);
        Review saved = reviewRepository.save(review);

        eventPublisher.publishReviewModerated(saved);
        if (Review.STATUS_APPROVED.equals(status)) {
            eventPublisher.publishReviewApproved(saved);
        }
        return saved;
    }
}
