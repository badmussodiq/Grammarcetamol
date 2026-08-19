package com.grammarcetamol.auth.service;

import com.grammarcetamol.auth.entity.User;
import com.grammarcetamol.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Records a failed login attempt in its own transaction, independent of the caller's.
 *
 * AuthService.login() always ends a failed attempt by throwing (InvalidTokenException or
 * AccountLockedException) to report the failure to the controller — but Spring's default
 * @Transactional rolls back on any unchecked exception, which was silently discarding every
 * failedAttempts/lockedUntil update the moment it was written. The account-lockout feature
 * has never actually persisted a single failed attempt because of this: found by an
 * integration test that logs in with a wrong password 5 times and checks the database
 * directly, not by any existing unit test (those mock the repository, which doesn't simulate
 * real transactional rollback). REQUIRES_NEW commits this update in its own transaction
 * before login()'s own transaction rolls back, exactly like recording a failed attempt is
 * supposed to survive the very failure it's recording.
 */
@Service
@RequiredArgsConstructor
public class LoginAttemptService {

    private final UserRepository userRepository;

    private static final int MAX_FAILED_ATTEMPTS   = 5;
    private static final int LOCK_DURATION_MINUTES = 15;

    /** Returns the new lockedUntil instant if this attempt just tipped the account into a
     * lock, or null if it didn't (account isn't locked yet). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Instant recordFailedAttempt(UUID userId) {
        User user = userRepository.findById(userId).orElseThrow();
        user.setFailedAttempts(user.getFailedAttempts() + 1);
        Instant lockedUntil = null;
        if (user.getFailedAttempts() >= MAX_FAILED_ATTEMPTS) {
            lockedUntil = Instant.now().plus(Duration.ofMinutes(LOCK_DURATION_MINUTES));
            user.setLockedUntil(lockedUntil);
        }
        userRepository.save(user);
        return lockedUntil;
    }
}
