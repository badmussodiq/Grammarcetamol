package com.grammarcetamol.auth.messaging;

import com.grammarcetamol.auth.service.UserProfileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Listens to user-lifecycle events on the shared RabbitMQ exchange.
 * <p>
 * This handles any external producers still publishing {@code user.created}
 * events. For registrations that originate within this service the profile
 * is initialised inline by {@link com.grammarcetamol.auth.service.AuthService},
 * so these listeners are effectively a safety net / external integration point.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserEventListener {

    private final UserProfileService userProfileService;

    @RabbitListener(queues = "#{T(com.grammarcetamol.auth.config.RabbitMQConfig).CREATED_QUEUE}")
    public void onUserCreated(Map<String, Object> payload) {
        try {
            UUID   userId   = UUID.fromString((String) payload.get("userId"));
            String fullName = (String) payload.getOrDefault("fullName", "");
            String role     = (String) payload.getOrDefault("role", "STUDENT");

            userProfileService.initProfile(userId, fullName, role);
        } catch (Exception e) {
            log.error("Failed to handle user.created event — payload={} error={}",
                payload, e.getMessage(), e);
            throw e;
        }
    }

    @RabbitListener(queues = "#{T(com.grammarcetamol.auth.config.RabbitMQConfig).VERIFIED_QUEUE}")
    public void onUserVerified(Map<String, Object> payload) {
        log.info("user.verified received for userId={}", payload.get("userId"));
    }
}
