package com.grammarcetamol.auth.service;

import com.grammarcetamol.auth.dto.LoginRequest;
import com.grammarcetamol.auth.dto.RegisterRequest;
import com.grammarcetamol.auth.entity.RoleName;
import com.grammarcetamol.auth.entity.User;
import com.grammarcetamol.auth.exception.AccountLockedException;
import com.grammarcetamol.auth.exception.EmailAlreadyExistsException;
import com.grammarcetamol.auth.exception.InvalidPasswordException;
import com.grammarcetamol.auth.exception.InvalidTokenException;
import com.grammarcetamol.auth.messaging.UserEventPublisher;
import com.grammarcetamol.auth.repository.RefreshTokenRepository;
import com.grammarcetamol.auth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
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
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private StringRedisTemplate redisTemplate;
    @Mock
    private ValueOperations<String, String> valueOps;
    @Mock
    private UserEventPublisher eventPublisher;
    @Mock
    private UserProfileService userProfileService;

    @InjectMocks
    private AuthService authService;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
    }

    // -----------------------------------------------------------------------
    // register
    // -----------------------------------------------------------------------

    @Test
    void register_success_savesUserAndInitialisesProfile() {
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
        verify(userProfileService).initProfile(
                any(UUID.class), eq("Test User"), eq(RoleName.STUDENT.name())
        );
        verify(eventPublisher).publishNotification(
                eq("email-verification-otp"), eq("test@example.com"), eq("Test User"), anyMap(), any(UUID.class)
        );
        verifyNoMoreInteractions(eventPublisher);
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

        verifyNoInteractions(userProfileService);
    }

    // -----------------------------------------------------------------------
    // registerInternal
    // -----------------------------------------------------------------------

    @Test
    void registerInternal_newEmail_createsActiveUserAndInitialisesProfile() {
        when(userRepository.existsByEmail("admin@example.com")).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });

        authService.registerInternal("admin@example.com", "Secret123", "Super Admin",
                RoleName.SUPER_ADMIN.name());

        verify(userRepository).save(argThat(u ->
                u.getStatus() == User.Status.ACTIVE && u.isEmailVerified()
        ));
        verify(userProfileService).initProfile(
                any(UUID.class), eq("Super Admin"), eq(RoleName.SUPER_ADMIN.name())
        );
    }

    @Test
    void registerInternal_existingEmail_throwsEmailAlreadyExistsException() {
        when(userRepository.existsByEmail("admin@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.registerInternal(
                "admin@example.com", "Secret123", "Super Admin", RoleName.SUPER_ADMIN.name()))
                .isInstanceOf(EmailAlreadyExistsException.class);

        verify(userRepository, never()).save(any());
        verifyNoInteractions(userProfileService);
    }

    @Test
    void registerInternal_weakPassword_throwsInvalidPasswordException() {
        when(userRepository.existsByEmail("admin@example.com")).thenReturn(false);

        assertThatThrownBy(() -> authService.registerInternal(
                "admin@example.com", "weak", "Super Admin", RoleName.SUPER_ADMIN.name()))
                .isInstanceOf(InvalidPasswordException.class);

        verify(userRepository, never()).save(any());
        verifyNoInteractions(userProfileService);
    }

    // -----------------------------------------------------------------------
    // login
    // -----------------------------------------------------------------------

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
        verify(eventPublisher).publishNotification(eq("account-locked"), eq("user@example.com"), anyString(), anyMap(), eq(user.getId()));
    }

    @Test
    void login_5thFailure_missingFullName_fallsBackToEmail_doesNotCrash() {
        // Map.of throws NullPointerException on a null value — a user with no fullName set
        // must not take the lockout response down with it.
        User user = createActiveUser();
        user.setFullName(null);
        user.setFailedAttempts(4);

        LoginRequest req = new LoginRequest();
        req.setEmail("user@example.com");
        req.setPassword("wrong");

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(req, null))
                .isInstanceOf(AccountLockedException.class);

        verify(eventPublisher).publishNotification(eq("account-locked"), eq("user@example.com"), eq("user@example.com"), anyMap(), eq(user.getId()));
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

    // -----------------------------------------------------------------------
    // verifyEmail
    // -----------------------------------------------------------------------

    @Test
    void verifyEmail_correctOtp_activatesUser() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("user@example.com");
        user.setStatus(User.Status.PENDING_VERIFICATION);

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(valueOps.get("otp:verify:user@example.com")).thenReturn("123456");

        authService.verifyEmail("user@example.com", "123456");

        assertThat(user.isEmailVerified()).isTrue();
        assertThat(user.getStatus()).isEqualTo(User.Status.ACTIVE);
        verifyNoMoreInteractions(eventPublisher);
    }

    @Test
    void verifyEmail_wrongOtp_throwsInvalidTokenException() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("user@example.com");
        user.setStatus(User.Status.PENDING_VERIFICATION);

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(valueOps.get("otp:verify:user@example.com")).thenReturn("123456");

        assertThatThrownBy(() -> authService.verifyEmail("user@example.com", "999999"))
                .isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void verifyEmail_expiredOrNeverIssuedOtp_throwsInvalidTokenException() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("user@example.com");

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(valueOps.get("otp:verify:user@example.com")).thenReturn(null);

        assertThatThrownBy(() -> authService.verifyEmail("user@example.com", "123456"))
                .isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void verifyEmail_unknownEmail_throwsInvalidTokenException() {
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.verifyEmail("nobody@example.com", "123456"))
                .isInstanceOf(InvalidTokenException.class);
    }

    // -----------------------------------------------------------------------
    // forgotPassword / resetPassword
    // -----------------------------------------------------------------------

    @Test
    void forgotPassword_existingEmail_publishesOtpNotification() {
        User user = createActiveUser();
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));

        authService.forgotPassword("user@example.com");

        verify(valueOps).set(eq("otp:fp:user@example.com"), anyString(), any());
        verify(eventPublisher).publishNotification(eq("password-reset-otp"), eq("user@example.com"), anyString(), anyMap(), eq(user.getId()));
    }

    @Test
    void forgotPassword_unknownEmail_doesNothing() {
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        authService.forgotPassword("nobody@example.com");

        verifyNoInteractions(eventPublisher);
    }

    @Test
    void resetPassword_correctOtp_updatesPasswordAndRevokesSessions() {
        User user = createActiveUser();
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(valueOps.get("otp:fp:user@example.com")).thenReturn("654321");
        when(passwordEncoder.encode("NewPass123!")).thenReturn("newHashed");

        authService.resetPassword("user@example.com", "654321", "NewPass123!");

        assertThat(user.getPasswordHash()).isEqualTo("newHashed");
        verify(refreshTokenRepository).deleteAllByUserId(user.getId());
    }

    @Test
    void resetPassword_wrongOtp_throwsInvalidTokenException() {
        User user = createActiveUser();
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(valueOps.get("otp:fp:user@example.com")).thenReturn("654321");

        assertThatThrownBy(() -> authService.resetPassword("user@example.com", "000000", "NewPass123!"))
                .isInstanceOf(InvalidTokenException.class);

        verify(userRepository, never()).save(any());
    }

    // -----------------------------------------------------------------------
    // resendVerification
    // -----------------------------------------------------------------------

    @Test
    void resendVerification_unverifiedUser_publishesNewOtp() {
        User user = createActiveUser();
        user.setEmailVerified(false);
        when(redisTemplate.hasKey("resend:user@example.com")).thenReturn(false);
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));

        authService.resendVerification("user@example.com");

        verify(eventPublisher).publishNotification(eq("email-verification-otp"), eq("user@example.com"), anyString(), anyMap(), eq(user.getId()));
    }

    @Test
    void resendVerification_alreadyVerifiedUser_doesNotPublish() {
        User user = createActiveUser();
        user.setEmailVerified(true);
        when(redisTemplate.hasKey("resend:user@example.com")).thenReturn(false);
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));

        authService.resendVerification("user@example.com");

        verifyNoInteractions(eventPublisher);
    }

    @Test
    void resendVerification_rateLimited_throwsInvalidTokenException() {
        when(redisTemplate.hasKey("resend:user@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.resendVerification("user@example.com"))
                .isInstanceOf(InvalidTokenException.class);

        verifyNoInteractions(userRepository);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

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
