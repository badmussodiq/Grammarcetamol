package com.grammarcetamol.enrollment.service;

import com.grammarcetamol.enrollment.client.CourseDetailDto;
import com.grammarcetamol.enrollment.client.CourseDetailDto.CourseSummary;
import com.grammarcetamol.enrollment.client.CourseDetailDto.LessonSummary;
import com.grammarcetamol.enrollment.client.CourseDetailDto.ModuleSummary;
import com.grammarcetamol.enrollment.client.CourseServiceClient;
import com.grammarcetamol.enrollment.config.AppProperties;
import com.grammarcetamol.enrollment.dto.AtRiskEnrollmentResponse;
import com.grammarcetamol.enrollment.dto.LearnResponse;
import com.grammarcetamol.enrollment.entity.Enrollment;
import com.grammarcetamol.enrollment.entity.LessonProgress;
import com.grammarcetamol.enrollment.messaging.EnrollmentEventPublisher;
import com.grammarcetamol.enrollment.repository.EnrollmentRepository;
import com.grammarcetamol.enrollment.repository.LessonProgressRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EnrollmentServiceTest {

    @Mock
    private EnrollmentRepository enrollmentRepository;
    @Mock
    private LessonProgressRepository lessonProgressRepository;
    @Mock
    private CourseServiceClient courseServiceClient;
    @Mock
    private EnrollmentEventPublisher eventPublisher;

    private EnrollmentService enrollmentService;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID COURSE_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        AppProperties appProperties = new AppProperties();
        appProperties.setAtRiskCompletionThresholdPct(20);
        appProperties.setAtRiskMinDaysSinceEnrollment(14);
        enrollmentService = new EnrollmentService(
            enrollmentRepository, lessonProgressRepository, courseServiceClient, eventPublisher, appProperties);
    }

    // ---- enrollFree ----

    @Test
    void enrollFree_alreadyEnrolled_returnsExistingWithoutTouchingCourseService() {
        Enrollment existing = enrollment(COURSE_ID, BigDecimal.ZERO);
        when(enrollmentRepository.findByUserIdAndCourseId(USER_ID, COURSE_ID)).thenReturn(Optional.of(existing));

        Enrollment result = enrollmentService.enrollFree(USER_ID, COURSE_ID);

        assertThat(result).isSameAs(existing);
        verifyNoInteractions(courseServiceClient);
        verify(enrollmentRepository, never()).save(any());
    }

    @Test
    void enrollFree_freePublishedCourse_createsEnrollmentAndPublishesEvent() {
        when(enrollmentRepository.findByUserIdAndCourseId(USER_ID, COURSE_ID)).thenReturn(Optional.empty());
        when(courseServiceClient.getCourse(COURSE_ID)).thenReturn(courseDetail("published", BigDecimal.ZERO, List.of()));
        when(enrollmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Enrollment result = enrollmentService.enrollFree(USER_ID, COURSE_ID);

        assertThat(result.getUserId()).isEqualTo(USER_ID);
        assertThat(result.getCourseId()).isEqualTo(COURSE_ID);
        assertThat(result.getPricePaid()).isEqualByComparingTo(BigDecimal.ZERO);
        verify(eventPublisher).publishEnrollmentCreated(result);
    }

    @Test
    void enrollFree_paidCourse_throwsIllegalArgumentException() {
        when(enrollmentRepository.findByUserIdAndCourseId(USER_ID, COURSE_ID)).thenReturn(Optional.empty());
        when(courseServiceClient.getCourse(COURSE_ID)).thenReturn(courseDetail("published", BigDecimal.TEN, List.of()));

        assertThatThrownBy(() -> enrollmentService.enrollFree(USER_ID, COURSE_ID))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("not free");
    }

    @Test
    void enrollFree_unpublishedCourse_throwsIllegalStateException() {
        when(enrollmentRepository.findByUserIdAndCourseId(USER_ID, COURSE_ID)).thenReturn(Optional.empty());
        when(courseServiceClient.getCourse(COURSE_ID)).thenReturn(courseDetail("draft", BigDecimal.ZERO, List.of()));

        assertThatThrownBy(() -> enrollmentService.enrollFree(USER_ID, COURSE_ID))
            .isInstanceOf(IllegalStateException.class);
    }

    // ---- enrollFromPayment ----

    @Test
    void enrollFromPayment_idempotent_returnsExistingOnSecondDelivery() {
        Enrollment existing = enrollment(COURSE_ID, BigDecimal.valueOf(49.99));
        when(enrollmentRepository.findByUserIdAndCourseId(USER_ID, COURSE_ID)).thenReturn(Optional.of(existing));

        Enrollment result = enrollmentService.enrollFromPayment(USER_ID, COURSE_ID, UUID.randomUUID(), BigDecimal.valueOf(49.99), "USD");

        assertThat(result).isSameAs(existing);
        verify(enrollmentRepository, never()).save(any());
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void enrollFromPayment_newPayment_createsEnrollmentWithCorrectPricePaid() {
        UUID paymentId = UUID.randomUUID();
        when(enrollmentRepository.findByUserIdAndCourseId(USER_ID, COURSE_ID)).thenReturn(Optional.empty());
        when(enrollmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Enrollment result = enrollmentService.enrollFromPayment(USER_ID, COURSE_ID, paymentId, BigDecimal.valueOf(49.99), "USD");

        assertThat(result.getPricePaid()).isEqualByComparingTo("49.99");
        assertThat(result.getPaymentId()).isEqualTo(paymentId);
        verify(eventPublisher).publishEnrollmentCreated(result);
    }

    // ---- prerequisite gating (getLearnState) ----

    @Test
    void getLearnState_lockedUntilPreviousLessonCompleted() {
        UUID lesson1 = UUID.randomUUID();
        UUID lesson2 = UUID.randomUUID();
        UUID lesson3 = UUID.randomUUID();
        Enrollment enrollment = enrollment(COURSE_ID, BigDecimal.ZERO);

        when(enrollmentRepository.findByUserIdAndCourseId(USER_ID, COURSE_ID)).thenReturn(Optional.of(enrollment));
        when(courseServiceClient.getCourse(COURSE_ID)).thenReturn(courseDetail("published", BigDecimal.ZERO, List.of(
            new ModuleSummary(UUID.randomUUID(), "Module 1", 1, List.of(
                new LessonSummary(lesson1, "L1", "video", 5, 1, "http://video1", false, true),
                new LessonSummary(lesson2, "L2", "video", 5, 2, "http://video2", false, true),
                new LessonSummary(lesson3, "L3", "video", 5, 3, "http://video3", false, true)
            ))
        )));

        LessonProgress lesson1Progress = progress(enrollment.getId(), lesson1, LessonProgress.STATUS_COMPLETED);
        when(lessonProgressRepository.findByEnrollmentId(enrollment.getId())).thenReturn(List.of(lesson1Progress));

        LearnResponse learnState = enrollmentService.getLearnState(USER_ID, COURSE_ID);

        assertThat(learnState.modules()).hasSize(1);
        List<LearnResponse.LearnLesson> lessons = learnState.modules().get(0).lessons();
        assertThat(lessons.get(0).state()).isEqualTo("completed");
        assertThat(lessons.get(1).state()).isEqualTo("unlocked");
        assertThat(lessons.get(1).videoUrl()).isEqualTo("http://video2");
        assertThat(lessons.get(2).state()).isEqualTo("locked");
        assertThat(lessons.get(2).videoUrl()).isNull();
    }

    @Test
    void getLearnState_firstLessonAlwaysUnlockedForFreshEnrollment() {
        UUID lesson1 = UUID.randomUUID();
        Enrollment enrollment = enrollment(COURSE_ID, BigDecimal.ZERO);

        when(enrollmentRepository.findByUserIdAndCourseId(USER_ID, COURSE_ID)).thenReturn(Optional.of(enrollment));
        when(courseServiceClient.getCourse(COURSE_ID)).thenReturn(courseDetail("published", BigDecimal.ZERO, List.of(
            new ModuleSummary(UUID.randomUUID(), "Module 1", 1, List.of(
                new LessonSummary(lesson1, "L1", "video", 5, 1, "http://video1", false, true)
            ))
        )));
        when(lessonProgressRepository.findByEnrollmentId(enrollment.getId())).thenReturn(List.of());

        LearnResponse learnState = enrollmentService.getLearnState(USER_ID, COURSE_ID);

        assertThat(learnState.modules().get(0).lessons().get(0).state()).isEqualTo("unlocked");
    }

    @Test
    void getLearnState_notEnrolled_throwsNotFound() {
        when(enrollmentRepository.findByUserIdAndCourseId(USER_ID, COURSE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> enrollmentService.getLearnState(USER_ID, COURSE_ID))
            .isInstanceOf(jakarta.persistence.EntityNotFoundException.class);
    }

    // ---- updateProgress completes the enrollment when the last lesson finishes ----

    @Test
    void updateProgress_completingFinalLesson_marksEnrollmentCompleted() {
        UUID lessonId = UUID.randomUUID();
        Enrollment enrollment = enrollment(COURSE_ID, BigDecimal.ZERO);

        when(enrollmentRepository.findByUserIdAndCourseId(USER_ID, COURSE_ID)).thenReturn(Optional.of(enrollment));
        when(lessonProgressRepository.findByEnrollmentIdAndLessonId(enrollment.getId(), lessonId)).thenReturn(Optional.empty());
        when(lessonProgressRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(courseServiceClient.getCourse(COURSE_ID)).thenReturn(courseDetail("published", BigDecimal.ZERO, List.of(
            new ModuleSummary(UUID.randomUUID(), "Module 1", 1, List.of(
                new LessonSummary(lessonId, "L1", "video", 5, 1, "http://video1", false, true)
            ))
        )));
        when(lessonProgressRepository.countByEnrollmentIdAndStatus(enrollment.getId(), LessonProgress.STATUS_COMPLETED)).thenReturn(1L);

        enrollmentService.updateProgress(USER_ID, COURSE_ID, lessonId, 300, true);

        assertThat(enrollment.getStatus()).isEqualTo(Enrollment.STATUS_COMPLETED);
        verify(eventPublisher).publishEnrollmentCompleted(enrollment);
    }

    // ---- at-risk boundary ----

    @Test
    void getAtRisk_exactlyThresholdPercent_isNotAtRisk() {
        Enrollment candidate = enrollment(COURSE_ID, BigDecimal.ZERO);
        candidate.setEnrolledAt(Instant.now().minus(20, ChronoUnit.DAYS));
        when(enrollmentRepository.findByStatusAndEnrolledAtBefore(eq(Enrollment.STATUS_ACTIVE), any()))
            .thenReturn(List.of(candidate));
        when(courseServiceClient.getCourse(COURSE_ID)).thenReturn(courseDetail("published", BigDecimal.ZERO, List.of(
            new ModuleSummary(UUID.randomUUID(), "Module 1", 1, List.of(
                lesson(), lesson(), lesson(), lesson(), lesson()
            ))
        )));
        // exactly 1 of 5 lessons completed = 20% = the threshold, not strictly below it
        when(lessonProgressRepository.countByEnrollmentIdAndStatus(candidate.getId(), LessonProgress.STATUS_COMPLETED)).thenReturn(1L);

        List<AtRiskEnrollmentResponse> atRisk = enrollmentService.getAtRisk();

        assertThat(atRisk).isEmpty();
    }

    @Test
    void getAtRisk_belowThresholdPercent_isAtRisk() {
        Enrollment candidate = enrollment(COURSE_ID, BigDecimal.ZERO);
        candidate.setEnrolledAt(Instant.now().minus(20, ChronoUnit.DAYS));
        when(enrollmentRepository.findByStatusAndEnrolledAtBefore(eq(Enrollment.STATUS_ACTIVE), any()))
            .thenReturn(List.of(candidate));
        when(courseServiceClient.getCourse(COURSE_ID)).thenReturn(courseDetail("published", BigDecimal.ZERO, List.of(
            new ModuleSummary(UUID.randomUUID(), "Module 1", 1, List.of(
                lesson(), lesson(), lesson(), lesson(), lesson()
            ))
        )));
        // 0 of 5 completed = 0%, below the 20% threshold
        when(lessonProgressRepository.countByEnrollmentIdAndStatus(candidate.getId(), LessonProgress.STATUS_COMPLETED)).thenReturn(0L);

        List<AtRiskEnrollmentResponse> atRisk = enrollmentService.getAtRisk();

        assertThat(atRisk).hasSize(1);
        assertThat(atRisk.get(0).enrollmentId()).isEqualTo(candidate.getId());
    }

    // ---- helpers ----

    private Enrollment enrollment(UUID courseId, BigDecimal pricePaid) {
        Enrollment enrollment = new Enrollment();
        enrollment.setId(UUID.randomUUID());
        enrollment.setUserId(USER_ID);
        enrollment.setCourseId(courseId);
        enrollment.setPricePaid(pricePaid);
        enrollment.setStatus(Enrollment.STATUS_ACTIVE);
        enrollment.setEnrolledAt(Instant.now());
        return enrollment;
    }

    private LessonProgress progress(UUID enrollmentId, UUID lessonId, String status) {
        LessonProgress progress = new LessonProgress();
        progress.setEnrollmentId(enrollmentId);
        progress.setLessonId(lessonId);
        progress.setStatus(status);
        return progress;
    }

    private LessonSummary lesson() {
        return new LessonSummary(UUID.randomUUID(), "L", "video", 5, 1, "http://video", false, true);
    }

    private CourseDetailDto courseDetail(String status, BigDecimal price, List<ModuleSummary> modules) {
        return new CourseDetailDto(new CourseSummary(COURSE_ID, "Course", "course-slug", status, price), modules);
    }
}
