package com.grammarcetamol.enrollment.messaging;

import com.grammarcetamol.enrollment.client.AuthServiceClient;
import com.grammarcetamol.enrollment.client.AuthServiceClient.UserContactDto;
import com.grammarcetamol.enrollment.client.CourseServiceClient;
import com.grammarcetamol.enrollment.config.RabbitMQConfig;
import com.grammarcetamol.enrollment.entity.Enrollment;
import com.grammarcetamol.enrollment.entity.LessonProgress;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class EnrollmentEventPublisher {

    private final RabbitTemplate rabbitTemplate;
    private final CourseServiceClient courseServiceClient;
    private final AuthServiceClient authServiceClient;

    public void publishEnrollmentCreated(Enrollment enrollment) {
        publish("enrollment.created", Map.of(
            "enrollmentId", enrollment.getId().toString(),
            "userId", enrollment.getUserId().toString(),
            "courseId", enrollment.getCourseId().toString()
        ));
        publishEnrollmentConfirmationEmail(enrollment);
    }

    /** Covers both free and paid enrollment (paid flows through publishEnrollmentCreated too,
     * via enrollFromPayment). Best-effort: a lookup failure here must never break enrollment
     * creation itself, so every failure is caught and logged, not rethrown. */
    private void publishEnrollmentConfirmationEmail(Enrollment enrollment) {
        try {
            String courseTitle = courseServiceClient.getCourse(enrollment.getCourseId()).course().title();
            UserContactDto user = authServiceClient.getUser(enrollment.getUserId());
            String displayName = (user.fullName() != null && !user.fullName().isBlank()) ? user.fullName() : user.email();
            publish("enrollment.notification", Map.of(
                "service", "enrollment-service",
                "templateName", "enrollment-confirmation",
                "to", user.email(),
                "toName", displayName,
                "variables", Map.of("fullName", displayName, "courseTitle", courseTitle)
            ));
        } catch (Exception e) {
            log.error("Failed to publish enrollment-confirmation notification for enrollment {}: {}",
                enrollment.getId(), e.getMessage());
        }
    }

    public void publishEnrollmentCompleted(Enrollment enrollment) {
        publish("enrollment.completed", Map.of(
            "enrollmentId", enrollment.getId().toString(),
            "userId", enrollment.getUserId().toString(),
            "courseId", enrollment.getCourseId().toString()
        ));
    }

    public void publishLessonProgressUpdated(Enrollment enrollment, LessonProgress progress) {
        publish("lesson.progress.updated", Map.of(
            "enrollmentId", enrollment.getId().toString(),
            "userId", enrollment.getUserId().toString(),
            "courseId", enrollment.getCourseId().toString(),
            "lessonId", progress.getLessonId().toString(),
            "status", progress.getStatus()
        ));
    }

    private void publish(String routingKey, Object payload) {
        try {
            rabbitTemplate.convertAndSend(RabbitMQConfig.ENROLLMENT_EXCHANGE, routingKey, payload);
            log.debug("Published event [{}] with payload {}", routingKey, payload);
        } catch (Exception e) {
            log.error("Failed to publish event [{}]: {}", routingKey, e.getMessage());
        }
    }
}
