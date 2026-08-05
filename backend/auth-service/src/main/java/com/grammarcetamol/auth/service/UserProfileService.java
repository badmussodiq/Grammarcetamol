package com.grammarcetamol.auth.service;

import com.grammarcetamol.auth.dto.UpdateProfileRequest;
import com.grammarcetamol.auth.entity.RoleName;
import com.grammarcetamol.auth.entity.User;
import com.grammarcetamol.auth.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final UserRepository userRepository;

    // -----------------------------------------------------------------------
    // Internal — called from AuthService after saving the User record
    // -----------------------------------------------------------------------

    /**
     * Sets the profile fields on an already-persisted {@link User}.
     * Must be called within the same transaction that saved the user.
     *
     * @param userId   the user's PK
     * @param fullName display name supplied at registration
     * @param roleName enum name string, e.g. "STUDENT" or "SUPER_ADMIN"
     */
    @Transactional
    public void initProfile(UUID userId, String fullName, String roleName) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new EntityNotFoundException("User not found: " + userId));

        user.setFullName(fullName);
        user.setRole(parseRole(roleName));
        userRepository.save(user);
        log.info("Initialised profile for userId={} role={}", userId, roleName);
    }

    // -----------------------------------------------------------------------
    // Profile read / update (own profile)
    // -----------------------------------------------------------------------

    @Transactional(readOnly = true)
    public User getMyProfile(UUID userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new EntityNotFoundException("User not found: " + userId));
    }

    @Transactional
    public User updateMyProfile(UUID userId, UpdateProfileRequest dto) {
        User user = getMyProfile(userId);

        if (dto.getFullName()      != null) user.setFullName(dto.getFullName());
        if (dto.getPhone()         != null) user.setPhone(dto.getPhone());
        if (dto.getCountry()       != null) user.setCountry(dto.getCountry());
        if (dto.getTimezone()      != null) user.setTimezone(dto.getTimezone());
        if (dto.getBio()           != null) user.setBio(dto.getBio());
        if (dto.getLearningGoals() != null) user.setLearningGoals(
            dto.getLearningGoals().toArray(String[]::new));

        return userRepository.save(user);
    }

    // -----------------------------------------------------------------------
    // Admin operations
    // -----------------------------------------------------------------------

    @Transactional(readOnly = true)
    public Map<String, Object> getAllUsers(String query, int page, int limit) {
        PageRequest pageRequest = PageRequest.of(page - 1, limit);
        // A null query bound inside CONCAT() (as well as compared with IS NULL) gives
        // Hibernate an ambiguous type to infer for the parameter, and it has been
        // observed resolving it to bytea instead of varchar. Branch instead of relying
        // on the :query IS NULL clause in the JPQL.
        Page<User> result = (query == null || query.isBlank())
            ? userRepository.findAll(pageRequest)
            : userRepository.search(query, pageRequest);
        return Map.of(
            "data",  result.getContent(),
            "total", result.getTotalElements(),
            "page",  page,
            "limit", limit
        );
    }

    @Transactional(readOnly = true)
    public User getUserById(UUID id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("User " + id + " not found"));
    }

    @Transactional
    public User updateUserStatus(UUID userId, String statusStr) {
        User user = getMyProfile(userId);
        try {
            user.setStatus(User.Status.valueOf(statusStr.toUpperCase()));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown status: " + statusStr);
        }
        return userRepository.save(user);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private RoleName parseRole(String roleName) {
        if (roleName == null) return RoleName.STUDENT;
        try {
            return RoleName.valueOf(roleName.toUpperCase());
        } catch (IllegalArgumentException e) {
            log.warn("Unknown role '{}', defaulting to STUDENT", roleName);
            return RoleName.STUDENT;
        }
    }
}
