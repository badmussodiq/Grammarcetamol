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
import org.springframework.data.jpa.domain.Specification;
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
    public Map<String, Object> getAllUsers(String query, String roleStr, String statusStr, int page, int limit) {
        PageRequest pageRequest = PageRequest.of(page - 1, limit);
        RoleName role = parseRoleOrNull(roleStr);
        User.Status status = parseStatusOrNull(statusStr);

        // Built with Specification rather than a static JPQL "(:x IS NULL OR field = :x)" clause —
        // that pattern requires binding a null parameter for whichever filter is absent, and for
        // `status` (a native Postgres enum, @JdbcTypeCode(SqlTypes.NAMED_ENUM)) that null bind
        // fails outright rather than just risking the bytea-inference issue the README warns about
        // for CONCAT(). A Specification just omits the predicate entirely when a filter is absent,
        // so no null is ever bound for the enum column.
        Specification<User> spec = Specification.where(null);
        if (query != null && !query.isBlank()) {
            String pattern = "%" + query.toLowerCase() + "%";
            spec = spec.and((root, cq, cb) -> cb.or(
                cb.like(cb.lower(root.get("fullName")), pattern),
                cb.like(cb.lower(root.get("email")), pattern)
            ));
        }
        if (role != null) {
            spec = spec.and((root, cq, cb) -> cb.equal(root.get("role"), role));
        }
        if (status != null) {
            spec = spec.and((root, cq, cb) -> cb.equal(root.get("status"), status));
        }

        Page<User> result = userRepository.findAll(spec, pageRequest);
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

    /** Unlike {@link #parseRole}, a filter with an unrecognized value is treated as "no filter"
     * rather than defaulted — an admin's typo'd query param shouldn't silently narrow results. */
    private RoleName parseRoleOrNull(String roleName) {
        if (roleName == null || roleName.isBlank()) return null;
        try {
            return RoleName.valueOf(roleName.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private User.Status parseStatusOrNull(String statusName) {
        if (statusName == null || statusName.isBlank()) return null;
        try {
            return User.Status.valueOf(statusName.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
