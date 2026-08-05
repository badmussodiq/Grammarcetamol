package com.grammarcetamol.review.service;

import com.grammarcetamol.review.client.CompletionDto;
import com.grammarcetamol.review.client.EnrollmentServiceClient;
import com.grammarcetamol.review.config.AppProperties;
import com.grammarcetamol.review.entity.Review;
import com.grammarcetamol.review.exception.ReviewAlreadyExistsException;
import com.grammarcetamol.review.messaging.ReviewEventPublisher;
import com.grammarcetamol.review.repository.ReviewRepository;
import com.grammarcetamol.shared.exception.ForbiddenException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewServiceTest {

    @Mock
    private ReviewRepository reviewRepository;
    @Mock
    private EnrollmentServiceClient enrollmentServiceClient;
    @Mock
    private ReviewEventPublisher eventPublisher;

    private ReviewService reviewService;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID COURSE_ID = UUID.randomUUID();
    private static final UUID ENROLLMENT_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        AppProperties appProperties = new AppProperties();
        appProperties.setReviewCompletionThresholdPct(50);
        appProperties.setReviewEditWindowDays(7);
        reviewService = new ReviewService(reviewRepository, enrollmentServiceClient, eventPublisher, appProperties);
    }

    // ---- 50% completion gate ----

    @Test
    void create_below50PercentCompletion_isForbidden() {
        when(reviewRepository.findByUserIdAndCourseId(USER_ID, COURSE_ID)).thenReturn(Optional.empty());
        when(enrollmentServiceClient.getCompletion(USER_ID, COURSE_ID))
            .thenReturn(new CompletionDto(true, 49, ENROLLMENT_ID));

        assertThatThrownBy(() -> reviewService.create(USER_ID, COURSE_ID, 5, "Great", "Loved it"))
            .isInstanceOf(ForbiddenException.class)
            .hasMessageContaining("50%");
        verify(reviewRepository, never()).save(any());
    }

    @Test
    void create_exactly50PercentCompletion_isAllowed() {
        when(reviewRepository.findByUserIdAndCourseId(USER_ID, COURSE_ID)).thenReturn(Optional.empty());
        when(enrollmentServiceClient.getCompletion(USER_ID, COURSE_ID))
            .thenReturn(new CompletionDto(true, 50, ENROLLMENT_ID));
        when(reviewRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Review review = reviewService.create(USER_ID, COURSE_ID, 5, "Great", "Loved it");

        assertThat(review.getStatus()).isEqualTo(Review.STATUS_PENDING);
        assertThat(review.getEnrollmentId()).isEqualTo(ENROLLMENT_ID);
        verify(eventPublisher).publishReviewSubmitted(review);
    }

    @Test
    void create_notEnrolled_isForbidden() {
        when(reviewRepository.findByUserIdAndCourseId(USER_ID, COURSE_ID)).thenReturn(Optional.empty());
        when(enrollmentServiceClient.getCompletion(USER_ID, COURSE_ID))
            .thenReturn(new CompletionDto(false, 0, null));

        assertThatThrownBy(() -> reviewService.create(USER_ID, COURSE_ID, 5, "Great", "Loved it"))
            .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void create_duplicateSubmission_throwsConflictNotSecondRow() {
        Review existing = new Review();
        existing.setId(UUID.randomUUID());
        when(reviewRepository.findByUserIdAndCourseId(USER_ID, COURSE_ID)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> reviewService.create(USER_ID, COURSE_ID, 4, "Ok", "Fine"))
            .isInstanceOf(ReviewAlreadyExistsException.class);
        verifyNoInteractions(enrollmentServiceClient);
        verify(reviewRepository, never()).save(any());
    }

    // ---- 7-day edit window ----

    @Test
    void update_withinEditWindow_succeeds() {
        Review review = existingReview(Instant.now().minus(3, ChronoUnit.DAYS));
        when(reviewRepository.findById(review.getId())).thenReturn(Optional.of(review));
        when(reviewRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Review updated = reviewService.update(review.getId(), USER_ID, 4, "Updated title", "Updated comment");

        assertThat(updated.getRating()).isEqualTo(4);
        assertThat(updated.isEdited()).isTrue();
    }

    @Test
    void update_pastEditWindow_isForbidden() {
        Review review = existingReview(Instant.now().minus(8, ChronoUnit.DAYS));
        when(reviewRepository.findById(review.getId())).thenReturn(Optional.of(review));

        assertThatThrownBy(() -> reviewService.update(review.getId(), USER_ID, 4, "x", "y"))
            .isInstanceOf(ForbiddenException.class)
            .hasMessageContaining("7 days");
    }

    @Test
    void update_notOwner_isForbidden() {
        Review review = existingReview(Instant.now());
        when(reviewRepository.findById(review.getId())).thenReturn(Optional.of(review));

        assertThatThrownBy(() -> reviewService.update(review.getId(), UUID.randomUUID(), 4, "x", "y"))
            .isInstanceOf(ForbiddenException.class);
    }

    // ---- moderation ----

    @Test
    void moderate_approve_setsAuditFieldsAndPublishesBothEvents() {
        Review review = existingReview(Instant.now());
        UUID moderatorId = UUID.randomUUID();
        when(reviewRepository.findById(review.getId())).thenReturn(Optional.of(review));
        when(reviewRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Review moderated = reviewService.moderate(review.getId(), moderatorId, Review.STATUS_APPROVED, "Looks good");

        assertThat(moderated.getStatus()).isEqualTo(Review.STATUS_APPROVED);
        assertThat(moderated.getModeratedBy()).isEqualTo(moderatorId);
        assertThat(moderated.getModeratedAt()).isNotNull();
        verify(eventPublisher).publishReviewModerated(moderated);
        verify(eventPublisher).publishReviewApproved(moderated);
    }

    @Test
    void moderate_reject_doesNotPublishApproved() {
        Review review = existingReview(Instant.now());
        when(reviewRepository.findById(review.getId())).thenReturn(Optional.of(review));
        when(reviewRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        reviewService.moderate(review.getId(), UUID.randomUUID(), Review.STATUS_REJECTED, "Not relevant");

        verify(eventPublisher, never()).publishReviewApproved(any());
    }

    @Test
    void moderate_invalidStatus_throwsIllegalArgument() {
        assertThatThrownBy(() -> reviewService.moderate(UUID.randomUUID(), UUID.randomUUID(), "bogus", null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    private Review existingReview(Instant createdAt) {
        Review review = new Review();
        review.setId(UUID.randomUUID());
        review.setUserId(USER_ID);
        review.setCourseId(COURSE_ID);
        review.setEnrollmentId(ENROLLMENT_ID);
        review.setRating(5);
        review.setStatus(Review.STATUS_PENDING);
        review.setCreatedAt(createdAt);
        return review;
    }
}
