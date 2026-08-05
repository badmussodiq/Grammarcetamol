package com.grammarcetamol.enrollment.messaging;

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

    public void publishEnrollmentCreated(Enrollment enrollment) {
        publish("enrollment.created", Map.of(
            "enrollmentId", enrollment.getId().toString(),
            "userId", enrollment.getUserId().toString(),
            "courseId", enrollment.getCourseId().toString()
        ));
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
