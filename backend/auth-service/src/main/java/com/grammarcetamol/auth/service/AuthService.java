package com.grammarcetamol.auth.service;

import com.grammarcetamol.auth.dto.LoginRequest;
import com.grammarcetamol.auth.dto.RegisterRequest;
import com.grammarcetamol.auth.entity.RefreshToken;
import com.grammarcetamol.auth.entity.RoleName;
import com.grammarcetamol.auth.entity.User;
import com.grammarcetamol.auth.dto.PasswordPolicy;
import com.grammarcetamol.auth.exception.AccountLockedException;
import com.grammarcetamol.auth.exception.EmailAlreadyExistsException;
import com.grammarcetamol.auth.exception.InvalidPasswordException;
import com.grammarcetamol.auth.exception.InvalidTokenException;
import com.grammarcetamol.auth.messaging.UserEventPublisher;
import com.grammarcetamol.auth.repository.RefreshTokenRepository;
import com.grammarcetamol.auth.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository          userRepository;
    private final RefreshTokenRepository  refreshTokenRepository;
    private final JwtService              jwtService;
    private final PasswordEncoder         passwordEncoder;
    private final StringRedisTemplate     redisTemplate;
    private final UserEventPublisher      eventPublisher;
    private final UserProfileService      userProfileService;

    private static final int MAX_FAILED_ATTEMPTS    = 5;
    private static final int LOCK_DURATION_MINUTES  = 15;

    @Transactional
    public void register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new EmailAlreadyExistsException(request.getEmail());
        }
        User user = new User();
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setStatus(User.Status.PENDING_VERIFICATION);
        user = userRepository.save(user);

        String verifyToken = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set(
            "verify:" + verifyToken,
            user.getId().toString(),
            Duration.ofHours(24)
        );

        // Set profile fields on the same user record — no separate table
        userProfileService.initProfile(user.getId(), request.getFullName(), RoleName.STUDENT.name());
        log.info("Registered user {}", user.getEmail());
    }

    @Transactional
    public void verifyEmail(String token) {
        String userId = redisTemplate.opsForValue().get("verify:" + token);
        if (userId == null) {
            throw new InvalidTokenException("Verification token is invalid or expired");
        }
        User user = userRepository.findById(UUID.fromString(userId))
            .orElseThrow(() -> new InvalidTokenException("User not found"));
        user.setEmailVerified(true);
        user.setStatus(User.Status.ACTIVE);
        userRepository.save(user);
        redisTemplate.delete("verify:" + token);
        // Profile already exists — no additional action needed on verification
        log.info("Email verified for userId={}", user.getId());
    }

    @Transactional
    public Map<String, String> login(LoginRequest request, HttpServletResponse response) {
        User user = userRepository.findByEmail(request.getEmail())
            .orElseThrow(() -> new InvalidTokenException("Invalid credentials"));

        if (user.getLockedUntil() != null && Instant.now().isBefore(user.getLockedUntil())) {
            throw new AccountLockedException(user.getLockedUntil());
        }
        if (user.getStatus() == User.Status.SUSPENDED || user.getStatus() == User.Status.DELETED) {
            throw new InvalidTokenException("Account is not accessible");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            user.setFailedAttempts(user.getFailedAttempts() + 1);
            if (user.getFailedAttempts() >= MAX_FAILED_ATTEMPTS) {
                user.setLockedUntil(Instant.now().plus(Duration.ofMinutes(LOCK_DURATION_MINUTES)));
                userRepository.save(user);
                eventPublisher.publishUserLocked(user.getId());
                throw new AccountLockedException(user.getLockedUntil());
            }
            userRepository.save(user);
            throw new InvalidTokenException("Invalid credentials");
        }

        user.setFailedAttempts(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        String accessToken  = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken();
        storeRefreshToken(user, refreshToken, null, null);
        setTokenCookies(response, accessToken, refreshToken);

        eventPublisher.publishUserLogin(user.getId());
        List<String> roles = jwtService.getRolesFromToken(accessToken);
        return Map.of(
            "userId", user.getId().toString(),
            "email",  user.getEmail(),
            "roles",  String.join(",", roles)
        );
    }

    @Transactional
    public void logout(String jti, UUID userId, String accessToken, HttpServletResponse response) {
        try {
            Duration ttl = jwtService.getRemainingTtl(accessToken);
            if (!ttl.isNegative()) {
                redisTemplate.opsForValue().set(
                    "blacklist:" + jti, "1", ttl.toSeconds(), TimeUnit.SECONDS
                );
            }
        } catch (Exception e) {
            log.warn("Could not blacklist JWT: {}", e.getMessage());
        }
        refreshTokenRepository.deleteAllByUserId(userId);
        clearTokenCookies(response);
        eventPublisher.publishUserLogout(userId);
    }

    @Transactional
    public void refresh(String refreshTokenCookie, HttpServletResponse response) {
        String tokenHash = hashToken(refreshTokenCookie);
        RefreshToken rt = refreshTokenRepository.findByTokenHash(tokenHash)
            .orElseThrow(() -> new InvalidTokenException("Invalid refresh token"));

        if (rt.getRevokedAt() != null) {
            throw new InvalidTokenException("Refresh token has been revoked");
        }
        if (Instant.now().isAfter(rt.getExpiresAt())) {
            throw new InvalidTokenException("Refresh token has expired");
        }

        // Rotate: revoke old, create new
        rt.setRevokedAt(Instant.now());
        refreshTokenRepository.save(rt);

        String newRefreshToken = jwtService.generateRefreshToken();
        storeRefreshToken(rt.getUser(), newRefreshToken, null, null);

        String newAccessToken = jwtService.generateAccessToken(rt.getUser());
        setTokenCookies(response, newAccessToken, newRefreshToken);
    }

    @Transactional
    public void forgotPassword(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            String resetToken = UUID.randomUUID().toString();
            redisTemplate.opsForValue().set(
                "fp:" + resetToken, user.getId().toString(), Duration.ofHours(1)
            );
            // In production, send email here via mail service
            log.info("Password reset token created for {}", email);
        });
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        validatePasswordPolicy(newPassword);
        String userId = redisTemplate.opsForValue().get("fp:" + token);
        if (userId == null) {
            throw new InvalidTokenException("Reset token is invalid or expired");
        }
        User user = userRepository.findById(UUID.fromString(userId))
            .orElseThrow(() -> new InvalidTokenException("User not found"));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        refreshTokenRepository.deleteAllByUserId(user.getId());
        redisTemplate.delete("fp:" + token);
    }

    /**
     * Internal registration path used by seeders and admin tooling.
     * Skips the email-verification flow and marks the account ACTIVE immediately.
     * The caller supplies the role that will be broadcast on the user.created event.
     * Throws {@link EmailAlreadyExistsException} if the email is already taken —
     * callers that want idempotent "seed once" behaviour (e.g. {@code SuperAdminSeeder})
     * should catch that specifically.
     */
    @Transactional
    public User registerInternal(String email, String password, String fullName, String role) {
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }
        validatePasswordPolicy(password);
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setStatus(User.Status.ACTIVE);
        user.setEmailVerified(true);
        user = userRepository.save(user);

        // Set profile fields on the same user record — no separate table
        userProfileService.initProfile(user.getId(), fullName, role);
        log.info("Internal registration complete for {} with role={}", email, role);
        return userRepository.findById(user.getId()).orElse(user);
    }

    @Transactional
    public void resendVerification(String email) {
        String rateLimitKey = "resend:" + email;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(rateLimitKey))) {
            throw new InvalidTokenException("Verification email already sent. Please wait 60 seconds.");
        }
        redisTemplate.opsForValue().set(rateLimitKey, "1", Duration.ofSeconds(60));

        userRepository.findByEmail(email).ifPresent(user -> {
            if (!user.isEmailVerified()) {
                String verifyToken = UUID.randomUUID().toString();
                redisTemplate.opsForValue().set(
                    "verify:" + verifyToken, user.getId().toString(), Duration.ofHours(24)
                );
                log.info("Resent verification email to {}", email);
            }
        });
    }

    // --- Helpers ---

    private static final Pattern PASSWORD_PATTERN = Pattern.compile(PasswordPolicy.REGEX);

    private void validatePasswordPolicy(String password) {
        if (password == null || password.length() < 8 || !PASSWORD_PATTERN.matcher(password).matches()) {
            throw new InvalidPasswordException(PasswordPolicy.MESSAGE);
        }
    }

    private void storeRefreshToken(User user, String rawToken, String deviceInfo, String ipAddress) {
        RefreshToken rt = new RefreshToken();
        rt.setUser(user);
        rt.setTokenHash(hashToken(rawToken));
        rt.setDeviceInfo(deviceInfo);
        rt.setIpAddress(ipAddress);
        rt.setExpiresAt(Instant.now().plus(Duration.ofDays(7)));
        refreshTokenRepository.save(rt);
    }

    private void setTokenCookies(HttpServletResponse response, String accessToken, String refreshToken) {
        addCookie(response, "access_token",  accessToken,  900);
        addCookie(response, "refresh_token", refreshToken, 604800);
    }

    private void clearTokenCookies(HttpServletResponse response) {
        addCookie(response, "access_token",  "", 0);
        addCookie(response, "refresh_token", "", 0);
    }

    private void addCookie(HttpServletResponse response, String name, String value, int maxAge) {
        Cookie cookie = new Cookie(name, value);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(maxAge);
        response.addCookie(cookie);
    }

    private String hashToken(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("Failed to hash token", e);
        }
    }
}
