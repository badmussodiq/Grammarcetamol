package com.grammarcetamol.auth.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

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

    private void publish(String routingKey, Object payload) {
        try {
            rabbitTemplate.convertAndSend(EXCHANGE, routingKey, payload);
            log.debug("Published event [{}] with payload {}", routingKey, payload);
        } catch (Exception e) {
            log.error("Failed to publish event [{}]: {}", routingKey, e.getMessage());
        }
    }
}
