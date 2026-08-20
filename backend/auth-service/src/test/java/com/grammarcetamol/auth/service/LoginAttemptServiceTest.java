package com.grammarcetamol.auth.service;

import com.grammarcetamol.auth.entity.User;
import com.grammarcetamol.auth.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LoginAttemptServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private LoginAttemptService loginAttemptService;

    private User userWithFailedAttempts(int count) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setFailedAttempts(count);
        return user;
    }

    @Test
    void recordFailedAttempt_belowThreshold_incrementsAndReturnsNull() {
        User user = userWithFailedAttempts(2);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        Instant lockedUntil = loginAttemptService.recordFailedAttempt(user.getId());

        assertThat(lockedUntil).isNull();
        assertThat(user.getFailedAttempts()).isEqualTo(3);
        assertThat(user.getLockedUntil()).isNull();
        verify(userRepository).save(user);
    }

    @Test
    void recordFailedAttempt_5thAttempt_locksAndReturnsLockedUntil() {
        User user = userWithFailedAttempts(4);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        Instant lockedUntil = loginAttemptService.recordFailedAttempt(user.getId());

        assertThat(lockedUntil).isNotNull().isAfter(Instant.now());
        assertThat(user.getFailedAttempts()).isEqualTo(5);
        assertThat(user.getLockedUntil()).isEqualTo(lockedUntil);
        verify(userRepository).save(user);
    }
}
