package com.grammarcetamol.auth.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Publishes user-lifecycle audit events to the shared RabbitMQ exchange.
 *
 * NOTE: user.created and user.verified are no longer published here.
 * Profile creation is now handled in-process by {@link com.grammarcetamol.auth.service.UserProfileService}
 * directly from {@link com.grammarcetamol.auth.service.AuthService}, eliminating the
 * async round-trip that previously required the separate NestJS user-service.
 *
 * The remaining events (login, logout, locked) are kept for audit/analytics consumers.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserEventPublisher {

    private static final String EXCHANGE = "user.exchange";

    private final RabbitTemplate rabbitTemplate;

    public void publishUserLogin(UUID userId) {
        publish("user.login", Map.of("userId", userId.toString()));
    }

    public void publishUserLogout(UUID userId) {
        publish("user.logout", Map.of("userId", userId.toString()));
    }

    public void publishUserLocked(UUID userId) {
        publish("user.locked", Map.of("userId", userId.toString()));
    }

    /** Distinct routing key from the audit events above — {@code user.notification} carries
     * the generic {service, templateName, to, toName, variables} shape Notification Service's
     * consumer expects (see backend/notification-service/src/config/amqp.constants.ts), not a
     * domain-shaped payload. No new exchange: still user.exchange, just a key nothing else in
     * this codebase binds to yet. */
    public void publishNotification(String templateName, String to, String toName, Map<String, Object> variables) {
        publishNotification(templateName, to, toName, variables, null);
    }

    /** Overload carrying the user's id, so notification-service can also write an in-app
     * notification (see backend/notification-service/src/notifications/) alongside the email —
     * a plain HashMap here, not Map.of, since userId is conditionally present and Map.of throws
     * on a null value/omitted entry mid-builder-chain. */
    public void publishNotification(String templateName, String to, String toName, Map<String, Object> variables, UUID userId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("service", "auth-service");
        payload.put("templateName", templateName);
        payload.put("to", to);
        payload.put("toName", toName);
        payload.put("variables", variables);
        if (userId != null) {
            payload.put("userId", userId.toString());
        }
        publish("user.notification", payload);
    }

    private void publish(String routingKey, Object payload) {
        try {
            rabbitTemplate.convertAndSend(EXCHANGE, routingKey, payload);
            log.debug("Published event [{}] with payload {}", routingKey, payload);
        } catch (Exception e) {
            log.error("Failed to publish event [{}]: {}", routingKey, e.getMessage());
        }
    }
}
