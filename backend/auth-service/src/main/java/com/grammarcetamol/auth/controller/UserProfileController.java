package com.grammarcetamol.auth.controller;

import com.grammarcetamol.auth.dto.ApiResponse;
import com.grammarcetamol.auth.dto.ChangePasswordRequest;
import com.grammarcetamol.auth.dto.CreateUserRequest;
import com.grammarcetamol.auth.dto.UpdateProfileRequest;
import com.grammarcetamol.auth.entity.User;
import com.grammarcetamol.auth.service.AuthService;
import com.grammarcetamol.auth.service.UserProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserProfileService userProfileService;
    private final AuthService authService;

    /** GET /api/users/me — any authenticated user */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<User>> getMyProfile(
            @AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.ok(ApiResponse.success(userProfileService.getMyProfile(userId)));
    }

    /** PATCH /api/users/me — any authenticated user */
    @PatchMapping("/me")
    public ResponseEntity<ApiResponse<User>> updateMyProfile(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateProfileRequest dto) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.ok(ApiResponse.success(userProfileService.updateMyProfile(userId, dto)));
    }

    /** POST /api/users/me/change-password — any authenticated user, requires current password */
    @PostMapping("/me/change-password")
    public ResponseEntity<ApiResponse<String>> changePassword(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ChangePasswordRequest dto) {
        UUID userId = UUID.fromString(jwt.getSubject());
        userProfileService.changePassword(userId, dto.getCurrentPassword(), dto.getNewPassword());
        return ResponseEntity.ok(ApiResponse.success("Password updated"));
    }

    /** POST /api/users — SUPER_ADMIN only. Creates a Moderator/Customer Support staff account. */
    @PostMapping
    @PreAuthorize("hasAuthority('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<User>> createUser(@Valid @RequestBody CreateUserRequest request) {
        User created = authService.registerInternal(
            request.getEmail(), request.getPassword(), request.getFullName(), request.getRole());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(created));
    }

    /** GET /api/users?q=&role=&status=&page=1&limit=20 — SUPER_ADMIN or MODERATOR.
     * role/status are optional filters (e.g. role=STUDENT for the admin student directory). */
    @GetMapping
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'MODERATOR')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAllUsers(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1")  int page,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(ApiResponse.success(
            userProfileService.getAllUsers(q, role, status, page, limit)));
    }

    /** GET /api/users/:id — SUPER_ADMIN or MODERATOR */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'MODERATOR')")
    public ResponseEntity<ApiResponse<User>> getUserById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(userProfileService.getUserById(id)));
    }

    /** PATCH /api/users/:id/status — SUPER_ADMIN only */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<User>> updateUserStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.success(
            userProfileService.updateUserStatus(id, body.get("status"))));
    }
}
