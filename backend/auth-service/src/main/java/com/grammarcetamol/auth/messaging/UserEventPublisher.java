package com.grammarcetamol.auth.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class UserEventPublisher {

    private static final String EXCHANGE = "user.exchange";

    private final RabbitTemplate rabbitTemplate;

    public void publishUserCreated(UUID userId, String email, String fullName) {
        Map<String, Object> payload = Map.of(
            "userId",   userId.toString(),
            "email",    email,
            "fullName", fullName
        );
        publish("user.created", payload);
    }

    public void publishUserVerified(UUID userId) {
        publish("user.verified", Map.of("userId", userId.toString()));
    }

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
