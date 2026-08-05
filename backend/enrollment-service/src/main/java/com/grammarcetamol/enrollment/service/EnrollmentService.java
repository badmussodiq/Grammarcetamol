package com.grammarcetamol.enrollment.service;

import com.grammarcetamol.enrollment.client.CourseDetailDto;
import com.grammarcetamol.enrollment.client.CourseDetailDto.LessonSummary;
import com.grammarcetamol.enrollment.client.CourseDetailDto.ModuleSummary;
import com.grammarcetamol.enrollment.client.CourseServiceClient;
import com.grammarcetamol.enrollment.config.AppProperties;
import com.grammarcetamol.enrollment.dto.AtRiskEnrollmentResponse;
import com.grammarcetamol.enrollment.dto.CompletionResponse;
import com.grammarcetamol.enrollment.dto.LearnResponse;
import com.grammarcetamol.enrollment.dto.LearnResponse.LearnLesson;
import com.grammarcetamol.enrollment.dto.LearnResponse.LearnModule;
import com.grammarcetamol.enrollment.entity.Enrollment;
import com.grammarcetamol.enrollment.entity.LessonProgress;
import com.grammarcetamol.enrollment.messaging.EnrollmentEventPublisher;
import com.grammarcetamol.enrollment.repository.EnrollmentRepository;
import com.grammarcetamol.enrollment.repository.LessonProgressRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EnrollmentService {

    private final EnrollmentRepository enrollmentRepository;
    private final LessonProgressRepository lessonProgressRepository;
    private final CourseServiceClient courseServiceClient;
    private final EnrollmentEventPublisher eventPublisher;
    private final AppProperties appProperties;

    @Transactional
    public Enrollment enrollFree(UUID userId, UUID courseId) {
        Optional<Enrollment> existing = enrollmentRepository.findByUserIdAndCourseId(userId, courseId);
        if (existing.isPresent()) {
            return existing.get();
        }

        CourseDetailDto course = courseServiceClient.getCourse(courseId);
        if (!"published".equals(course.course().status())) {
            throw new IllegalStateException("Course is not published");
        }
        if (course.course().price() != null && course.course().price().compareTo(BigDecimal.ZERO) > 0) {
            throw new IllegalArgumentException("This course is not free — use checkout to purchase it");
        }

        Enrollment enrollment = createEnrollment(userId, courseId, BigDecimal.ZERO, "USD", null);
        eventPublisher.publishEnrollmentCreated(enrollment);
        return enrollment;
    }

    /** Called by PaymentEventListener on payment.completed. Idempotent — safe to redeliver. */
    @Transactional
    public Enrollment enrollFromPayment(UUID userId, UUID courseId, UUID paymentId, BigDecimal pricePaid, String currency) {
        Optional<Enrollment> existing = enrollmentRepository.findByUserIdAndCourseId(userId, courseId);
        if (existing.isPresent()) {
            return existing.get();
        }

        Enrollment enrollment = createEnrollment(userId, courseId, pricePaid, currency, paymentId);
        eventPublisher.publishEnrollmentCreated(enrollment);
        return enrollment;
    }

    private Enrollment createEnrollment(UUID userId, UUID courseId, BigDecimal pricePaid, String currency, UUID paymentId) {
        Enrollment enrollment = new Enrollment();
        enrollment.setUserId(userId);
        enrollment.setCourseId(courseId);
        enrollment.setPricePaid(pricePaid);
        enrollment.setCurrency(currency);
        enrollment.setPaymentId(paymentId);
        return enrollmentRepository.save(enrollment);
    }

    public List<Enrollment> getMyEnrollments(UUID userId) {
        return enrollmentRepository.findByUserIdOrderByEnrolledAtDesc(userId);
    }

    public LearnResponse getLearnState(UUID userId, UUID courseId) {
        Enrollment enrollment = enrollmentRepository.findByUserIdAndCourseId(userId, courseId)
            .orElseThrow(() -> new EntityNotFoundException("You are not enrolled in this course"));

        CourseDetailDto course = courseServiceClient.getCourse(courseId);
        Map<UUID, LessonProgress> progressByLesson = lessonProgressRepository.findByEnrollmentId(enrollment.getId())
            .stream().collect(Collectors.toMap(LessonProgress::getLessonId, p -> p));

        List<ModuleSummary> sortedModules = course.modules().stream()
            .sorted(Comparator.comparingInt(ModuleSummary::position))
            .toList();

        List<LearnModule> learnModules = new ArrayList<>();
        boolean previousCompleted = true; // the first lesson in the course is always unlocked
        int totalLessons = 0;
        int completedCount = 0;

        for (ModuleSummary module : sortedModules) {
            List<LessonSummary> sortedLessons = module.lessons().stream()
                .sorted(Comparator.comparingInt(LessonSummary::position))
                .toList();
            List<LearnLesson> learnLessons = new ArrayList<>();

            for (LessonSummary lesson : sortedLessons) {
                totalLessons++;
                LessonProgress progress = progressByLesson.get(lesson.id());
                boolean completed = progress != null && LessonProgress.STATUS_COMPLETED.equals(progress.getStatus());
                if (completed) {
                    completedCount++;
                }

                String state;
                if (completed) {
                    state = "completed";
                } else if (!previousCompleted) {
                    state = "locked";
                } else if (progress != null && LessonProgress.STATUS_IN_PROGRESS.equals(progress.getStatus())) {
                    state = "current";
                } else {
                    state = "unlocked";
                }

                learnLessons.add(new LearnLesson(
                    lesson.id(), lesson.title(), lesson.type(), lesson.duration(), lesson.position(),
                    "locked".equals(state) ? null : lesson.videoUrl(),
                    state,
                    progress != null ? progress.getWatchPosition() : 0
                ));

                previousCompleted = completed;
            }

            learnModules.add(new LearnModule(module.id(), module.title(), module.position(), learnLessons));
        }

        int completionPct = totalLessons == 0 ? 0 : (completedCount * 100) / totalLessons;
        return new LearnResponse(course.course().id(), course.course().title(), completionPct, learnModules);
    }

    @Transactional
    public LessonProgress updateProgress(UUID userId, UUID courseId, UUID lessonId, Integer currentTime, Boolean completed) {
        Enrollment enrollment = enrollmentRepository.findByUserIdAndCourseId(userId, courseId)
            .orElseThrow(() -> new EntityNotFoundException("You are not enrolled in this course"));

        LessonProgress progress = lessonProgressRepository.findByEnrollmentIdAndLessonId(enrollment.getId(), lessonId)
            .orElseGet(() -> {
                LessonProgress p = new LessonProgress();
                p.setEnrollmentId(enrollment.getId());
                p.setLessonId(lessonId);
                return p;
            });

        if (currentTime != null) {
            progress.setWatchPosition(currentTime);
        }
        progress.setLastAccessedAt(Instant.now());

        boolean wasCompleted = LessonProgress.STATUS_COMPLETED.equals(progress.getStatus());
        if (Boolean.TRUE.equals(completed) && !wasCompleted) {
            progress.setStatus(LessonProgress.STATUS_COMPLETED);
            progress.setCompletedAt(Instant.now());
            progress.setCompletionPct(BigDecimal.valueOf(100));
        } else if (!wasCompleted) {
            progress.setStatus(LessonProgress.STATUS_IN_PROGRESS);
        }

        LessonProgress saved = lessonProgressRepository.save(progress);
        eventPublisher.publishLessonProgressUpdated(enrollment, saved);

        if (Boolean.TRUE.equals(completed) && !wasCompleted) {
            maybeCompleteEnrollment(enrollment, courseId);
        }
        return saved;
    }

    private void maybeCompleteEnrollment(Enrollment enrollment, UUID courseId) {
        if (Enrollment.STATUS_COMPLETED.equals(enrollment.getStatus())) {
            return;
        }
        int totalLessons = totalLessonCount(courseServiceClient.getCourse(courseId));
        long completedLessons = lessonProgressRepository.countByEnrollmentIdAndStatus(enrollment.getId(), LessonProgress.STATUS_COMPLETED);
        if (totalLessons > 0 && completedLessons >= totalLessons) {
            enrollment.setStatus(Enrollment.STATUS_COMPLETED);
            enrollment.setCompletedAt(Instant.now());
            enrollmentRepository.save(enrollment);
            eventPublisher.publishEnrollmentCompleted(enrollment);
        }
    }

    /** Called by review-service (internal caller) to check the 50%-completion gate. */
    public CompletionResponse getCompletion(UUID userId, UUID courseId) {
        Optional<Enrollment> enrollmentOpt = enrollmentRepository.findByUserIdAndCourseId(userId, courseId);
        if (enrollmentOpt.isEmpty()) {
            return new CompletionResponse(false, 0, null);
        }
        Enrollment enrollment = enrollmentOpt.get();
        int totalLessons = totalLessonCount(courseServiceClient.getCourse(courseId));
        long completedLessons = lessonProgressRepository.countByEnrollmentIdAndStatus(enrollment.getId(), LessonProgress.STATUS_COMPLETED);
        int pct = totalLessons == 0 ? 0 : (int) ((completedLessons * 100) / totalLessons);
        return new CompletionResponse(true, pct, enrollment.getId());
    }

    /**
     * completion% < threshold AND enrolled more than N days ago AND still active. Course lookups
     * are batched by distinct courseId (not per-enrollment) to avoid an N+1 REST fan-out.
     */
    public List<AtRiskEnrollmentResponse> getAtRisk() {
        Instant cutoff = Instant.now().minus(appProperties.getAtRiskMinDaysSinceEnrollment(), ChronoUnit.DAYS);
        List<Enrollment> candidates = enrollmentRepository.findByStatusAndEnrolledAtBefore(Enrollment.STATUS_ACTIVE, cutoff);

        Map<UUID, Integer> lessonCountByCourse = new HashMap<>();
        List<AtRiskEnrollmentResponse> result = new ArrayList<>();

        for (Enrollment enrollment : candidates) {
            int totalLessons = lessonCountByCourse.computeIfAbsent(enrollment.getCourseId(), id -> {
                try {
                    return totalLessonCount(courseServiceClient.getCourse(id));
                } catch (EntityNotFoundException e) {
                    return 0;
                }
            });
            if (totalLessons == 0) {
                continue;
            }
            long completedLessons = lessonProgressRepository.countByEnrollmentIdAndStatus(enrollment.getId(), LessonProgress.STATUS_COMPLETED);
            int pct = (int) ((completedLessons * 100) / totalLessons);
            if (pct < appProperties.getAtRiskCompletionThresholdPct()) {
                result.add(new AtRiskEnrollmentResponse(enrollment.getId(), enrollment.getUserId(),
                    enrollment.getCourseId(), pct, enrollment.getEnrolledAt()));
            }
        }
        return result;
    }

    private int totalLessonCount(CourseDetailDto course) {
        return course.modules().stream().mapToInt(m -> m.lessons().size()).sum();
    }
}
