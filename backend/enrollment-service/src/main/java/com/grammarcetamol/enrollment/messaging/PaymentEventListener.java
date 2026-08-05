package com.grammarcetamol.enrollment.messaging;

import com.grammarcetamol.enrollment.config.RabbitMQConfig;
import com.grammarcetamol.enrollment.service.EnrollmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

/**
 * Consumes payment-service's payment.completed event (backend/payment-service, Task 21) and
 * creates the paid enrollment. Expected payload: { paymentId, userId, courseId, amount, currency }
 * — amount/currency become the enrollment's price_paid/currency audit fields.
 *
 * EnrollmentService.enrollFromPayment is idempotent on (user_id, course_id), so redelivery
 * (at-least-once messaging, or the checkout flow's own confirm-endpoint racing the webhook) is
 * safe — a second delivery is a no-op, not a duplicate enrollment.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentEventListener {

    private final EnrollmentService enrollmentService;

    @RabbitListener(queues = RabbitMQConfig.PAYMENT_COMPLETED_QUEUE)
    public void onPaymentCompleted(Map<String, Object> payload) {
        try {
            UUID paymentId = UUID.fromString((String) payload.get("paymentId"));
            UUID userId = UUID.fromString((String) payload.get("userId"));
            UUID courseId = UUID.fromString((String) payload.get("courseId"));
            BigDecimal amount = new BigDecimal(String.valueOf(payload.get("amount")));
            String currency = (String) payload.getOrDefault("currency", "USD");

            enrollmentService.enrollFromPayment(userId, courseId, paymentId, amount, currency);
            log.info("Enrolled user {} in course {} from payment {}", userId, courseId, paymentId);
        } catch (Exception e) {
            log.error("Failed to process payment.completed event {}: {}", payload, e.getMessage());
        }
    }
}
