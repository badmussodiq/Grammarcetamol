package com.grammarcetamol.review.messaging;

import com.grammarcetamol.review.config.RabbitMQConfig;
import com.grammarcetamol.review.entity.Review;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class ReviewEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publishReviewSubmitted(Review review) {
        publish("review.submitted", Map.of(
            "reviewId", review.getId().toString(),
            "userId", review.getUserId().toString(),
            "courseId", review.getCourseId().toString(),
            "rating", review.getRating()
        ));
    }

    public void publishReviewApproved(Review review) {
        publish("review.approved", Map.of(
            "reviewId", review.getId().toString(),
            "courseId", review.getCourseId().toString(),
            "rating", review.getRating()
        ));
    }

    public void publishReviewModerated(Review review) {
        publish("review.moderated", Map.of(
            "reviewId", review.getId().toString(),
            "courseId", review.getCourseId().toString(),
            "status", review.getStatus()
        ));
    }

    private void publish(String routingKey, Object payload) {
        try {
            rabbitTemplate.convertAndSend(RabbitMQConfig.REVIEW_EXCHANGE, routingKey, payload);
            log.debug("Published event [{}] with payload {}", routingKey, payload);
        } catch (Exception e) {
            log.error("Failed to publish event [{}]: {}", routingKey, e.getMessage());
        }
    }
}
