package com.grammarcetamol.auth.service;

import com.grammarcetamol.auth.dto.LoginRequest;
import com.grammarcetamol.auth.dto.RegisterRequest;
import com.grammarcetamol.auth.entity.User;
import com.grammarcetamol.auth.exception.AccountLockedException;
import com.grammarcetamol.auth.exception.EmailAlreadyExistsException;
import com.grammarcetamol.auth.exception.InvalidTokenException;
import com.grammarcetamol.auth.messaging.UserEventPublisher;
import com.grammarcetamol.auth.repository.RefreshTokenRepository;
import com.grammarcetamol.auth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository         userRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private JwtService             jwtService;
    @Mock private PasswordEncoder        passwordEncoder;
    @Mock private StringRedisTemplate    redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private UserEventPublisher     eventPublisher;

    @InjectMocks
    private AuthService authService;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
    }

    @Test
    void register_success() {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("test@example.com");
        req.setPassword("password123");
        req.setFullName("Test User");

        when(userRepository.existsByEmail("test@example.com")).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });

        authService.register(req);

        verify(userRepository).save(any(User.class));
        verify(eventPublisher).publishUserCreated(any(), eq("test@example.com"), eq("Test User"));
    }

    @Test
    void register_duplicateEmail_throwsException() {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("dup@example.com");
        req.setPassword("password123");
        req.setFullName("Dup User");

        when(userRepository.existsByEmail("dup@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(req))
            .isInstanceOf(EmailAlreadyExistsException.class);
    }

    @Test
    void login_invalidPassword_incrementsFailedAttempts() {
        User user = createActiveUser();
        user.setFailedAttempts(3);

        LoginRequest req = new LoginRequest();
        req.setEmail("user@example.com");
        req.setPassword("wrong");

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(req, null))
            .isInstanceOf(InvalidTokenException.class);

        assertThat(user.getFailedAttempts()).isEqualTo(4);
        verify(userRepository).save(user);
    }

    @Test
    void login_5thFailure_locksAccount() {
        User user = createActiveUser();
        user.setFailedAttempts(4);

        LoginRequest req = new LoginRequest();
        req.setEmail("user@example.com");
        req.setPassword("wrong");

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(req, null))
            .isInstanceOf(AccountLockedException.class);

        assertThat(user.getLockedUntil()).isNotNull();
        assertThat(user.getLockedUntil()).isAfter(Instant.now());
        verify(eventPublisher).publishUserLocked(user.getId());
    }

    @Test
    void login_lockedAccount_throwsAccountLockedException() {
        User user = createActiveUser();
        user.setLockedUntil(Instant.now().plusSeconds(3600));

        LoginRequest req = new LoginRequest();
        req.setEmail("user@example.com");
        req.setPassword("password123");

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(req, null))
            .isInstanceOf(AccountLockedException.class);
    }

    @Test
    void verifyEmail_validToken_activatesUser() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("user@example.com");
        user.setStatus(User.Status.PENDING_VERIFICATION);

        String token = "valid-token";
        when(valueOps.get("verify:" + token)).thenReturn(user.getId().toString());
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        authService.verifyEmail(token);

        assertThat(user.isEmailVerified()).isTrue();
        assertThat(user.getStatus()).isEqualTo(User.Status.ACTIVE);
        verify(eventPublisher).publishUserVerified(user.getId());
    }

    @Test
    void verifyEmail_expiredToken_throwsInvalidTokenException() {
        when(valueOps.get("verify:expired-token")).thenReturn(null);

        assertThatThrownBy(() -> authService.verifyEmail("expired-token"))
            .isInstanceOf(InvalidTokenException.class);
    }

    private User createActiveUser() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("user@example.com");
        user.setPasswordHash("hashed");
        user.setStatus(User.Status.ACTIVE);
        user.setEmailVerified(true);
        return user;
    }
}
