package com.grammarcetamol.auth.controller;

import com.grammarcetamol.auth.dto.ApiResponse;
import com.grammarcetamol.auth.entity.User;
import com.grammarcetamol.auth.service.UserProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Service-to-service lookup only — never routed through the gateway (its route table only
 * forwards "/api/users/**", not "/api/internal/**"), so this is unreachable from a browser.
 * Exists because auth-service's own routes require a real signed JWT (OAuth2 resource server),
 * which other backend services can't mint; returning just email/fullName here (not the full
 * User entity) keeps the exposure minimal for services that only need "who do we email."
 */
@RestController
@RequestMapping("/api/internal/users")
@RequiredArgsConstructor
public class InternalUserController {

    private final UserProfileService userProfileService;

    public record InternalUserResponse(UUID id, String email, String fullName) {
    }

    @GetMapping("/{id}")
    public ApiResponse<InternalUserResponse> getUser(@PathVariable UUID id) {
        User user = userProfileService.getUserById(id);
        return ApiResponse.success(new InternalUserResponse(user.getId(), user.getEmail(), user.getFullName()));
    }
}
