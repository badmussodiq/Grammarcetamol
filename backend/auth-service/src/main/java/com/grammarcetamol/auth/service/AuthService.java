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
import java.security.SecureRandom;
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
    private static final int OTP_TTL_MINUTES        = 15;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

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

        // Set profile fields on the same user record — no separate table
        userProfileService.initProfile(user.getId(), request.getFullName(), RoleName.STUDENT.name());

        String otp = issueOtp("verify", user.getEmail());
        eventPublisher.publishNotification("email-verification-otp", user.getEmail(), request.getFullName(),
            Map.of("fullName", request.getFullName(), "otp", otp, "expiresInMinutes", String.valueOf(OTP_TTL_MINUTES)),
            user.getId());
        log.info("Registered user {}", user.getEmail());
    }

    @Transactional
    public void verifyEmail(String email, String otp) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new InvalidTokenException("Verification code is invalid or expired"));
        checkOtp("verify", email, otp);
        user.setEmailVerified(true);
        user.setStatus(User.Status.ACTIVE);
        userRepository.save(user);
        redisTemplate.delete("otp:verify:" + email);
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
                eventPublisher.publishNotification("account-locked", user.getEmail(), displayName(user),
                    Map.of("fullName", displayName(user), "lockDurationMinutes", String.valueOf(LOCK_DURATION_MINUTES)),
                    user.getId());
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
            String otp = issueOtp("fp", email);
            eventPublisher.publishNotification("password-reset-otp", email, displayName(user),
                Map.of("fullName", displayName(user), "otp", otp, "expiresInMinutes", String.valueOf(OTP_TTL_MINUTES)),
                user.getId());
            log.info("Password reset code issued for {}", email);
        });
    }

    @Transactional
    public void resetPassword(String email, String otp, String newPassword) {
        validatePasswordPolicy(newPassword);
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new InvalidTokenException("Reset code is invalid or expired"));
        checkOtp("fp", email, otp);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        refreshTokenRepository.deleteAllByUserId(user.getId());
        redisTemplate.delete("otp:fp:" + email);
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
                String otp = issueOtp("verify", email);
                eventPublisher.publishNotification("email-verification-otp", email, displayName(user),
                    Map.of("fullName", displayName(user), "otp", otp, "expiresInMinutes", String.valueOf(OTP_TTL_MINUTES)),
                    user.getId());
                log.info("Resent verification code to {}", email);
            }
        });
    }

    // --- Helpers ---

    /** {@code Map.of} throws NullPointerException on any null value, and User.fullName isn't
     * guaranteed non-null outside the registration path (registerInternal sets it, but nothing
     * stops a future data-migration or admin-tooling path from leaving it blank) — a null here
     * would otherwise crash the notification publish and, for the login-lockout call site,
     * take the account-lockout response down with it. Falls back to email, which is always
     * present, rather than the empty string, so templates still read naturally. */
    private String displayName(User user) {
        return user.getFullName() != null ? user.getFullName() : user.getEmail();
    }

    /** Generates a 6-digit numeric OTP and stores it keyed by (purpose, email) rather than by
     * the code itself — the caller already knows which user they're verifying, so there's no
     * need for the code to double as a lookup key the way the old UUID tokens did. This also
     * makes resend naturally idempotent: issuing a new code for the same purpose+email just
     * overwrites the previous one in Redis, so only the latest code is ever valid. */
    private String issueOtp(String purpose, String email) {
        String otp = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        redisTemplate.opsForValue().set("otp:" + purpose + ":" + email, otp, Duration.ofMinutes(OTP_TTL_MINUTES));
        return otp;
    }

    /** Same generic error message regardless of whether the key is missing (expired/never
     * issued) or present-but-wrong — never lets a caller distinguish "no code was ever sent to
     * this email" from "wrong code", which would otherwise leak whether an email is registered. */
    private void checkOtp(String purpose, String email, String otp) {
        String stored = redisTemplate.opsForValue().get("otp:" + purpose + ":" + email);
        if (stored == null || !stored.equals(otp)) {
            throw new InvalidTokenException("Verification code is invalid or expired");
        }
    }

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
