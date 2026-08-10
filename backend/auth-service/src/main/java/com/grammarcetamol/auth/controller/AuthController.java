package com.grammarcetamol.auth.controller;

import com.grammarcetamol.auth.dto.ApiResponse;
import com.grammarcetamol.auth.dto.LoginRequest;
import com.grammarcetamol.auth.dto.RegisterRequest;
import com.grammarcetamol.auth.dto.ResetPasswordRequest;
import com.grammarcetamol.auth.dto.VerifyEmailRequest;
import com.grammarcetamol.auth.service.AuthService;
import com.grammarcetamol.auth.service.JwtService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.interfaces.RSAPublicKey;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtService  jwtService;

    public record ResentVerificationRequestBody(@NotNull String email){};

    @GetMapping("/hello")
    public ResponseEntity<ApiResponse<String>> hello(){
        return ResponseEntity.ok(ApiResponse.success("Hello"));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<String>> register(@Valid @RequestBody RegisterRequest request) {
        authService.register(request);
        return ResponseEntity.ok(ApiResponse.success("Registration successful. Please verify your email."));
    }

    @PostMapping("/verify-email")
    public ResponseEntity<ApiResponse<String>> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        authService.verifyEmail(request.getEmail(), request.getOtp());
        return ResponseEntity.ok(ApiResponse.success("Email verified successfully"));
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<ApiResponse<String>> resendVerification(@RequestBody @Valid ResentVerificationRequestBody body) {
        authService.resendVerification(body.email);
        return ResponseEntity.ok(ApiResponse.success("Verification email sent if account exists"));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<Map<String, String>>> login(
            @RequestBody LoginRequest request,
            HttpServletResponse response) {
        Map<String, String> result = authService.login(request, response);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<String>> logout(
            HttpServletRequest request,
            HttpServletResponse response) {
        String accessToken = getCookieValue(request, "access_token");
        if (accessToken == null) {
            return ResponseEntity.ok(ApiResponse.success("Logged out"));
        }
        try {
            String jti    = jwtService.getJtiFromToken(accessToken);
            String userId = jwtService.getUserIdFromToken(accessToken);
            authService.logout(jti, UUID.fromString(userId), accessToken, response);
        } catch (Exception ignored) {
            // Token may already be expired — still clear cookies
        }
        return ResponseEntity.ok(ApiResponse.success("Logged out successfully"));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<String>> refresh(
            HttpServletRequest request,
            HttpServletResponse response) {
        String refreshToken = getCookieValue(request, "refresh_token");
        authService.refresh(refreshToken, response);
        return ResponseEntity.ok(ApiResponse.success("Token refreshed"));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<String>> forgotPassword(@RequestBody Map<String, String> body) {
        authService.forgotPassword(body.get("email"));
        return ResponseEntity.ok(ApiResponse.success("If that email exists, a reset link has been sent"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request.getEmail(), request.getOtp(), request.getNewPassword());
        return ResponseEntity.ok(ApiResponse.success("Password reset successfully"));
    }

    @GetMapping("/.well-known/jwks.json")
    public ResponseEntity<Map<String, Object>> jwks() {
        RSAPublicKey pub = (RSAPublicKey) jwtService.getPublicKey();
        Map<String, Object> key = Map.of(
            "kty", "RSA",
            "use", "sig",
            "alg", "RS256",
            "n",   Base64.getUrlEncoder().withoutPadding()
                        .encodeToString(pub.getModulus().toByteArray()),
            "e",   Base64.getUrlEncoder().withoutPadding()
                        .encodeToString(pub.getPublicExponent().toByteArray())
        );
        return ResponseEntity.ok(Map.of("keys", new Object[]{key}));
    }

    private String getCookieValue(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return null;
        for (Cookie cookie : request.getCookies()) {
            if (name.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }
}
