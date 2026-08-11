package com.grammarcetamol.auth.service;

import com.grammarcetamol.auth.dto.UpdateProfileRequest;
import com.grammarcetamol.auth.entity.RoleName;
import com.grammarcetamol.auth.entity.User;
import com.grammarcetamol.auth.exception.InvalidPasswordException;
import com.grammarcetamol.auth.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserProfileServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserProfileService userProfileService;

    // -----------------------------------------------------------------------
    // initProfile
    // -----------------------------------------------------------------------

    @Test
    void initProfile_setsFullNameAndRole() {
        UUID userId = UUID.randomUUID();
        User user = buildUser(userId, RoleName.STUDENT);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        userProfileService.initProfile(userId, "Alice", "SUPER_ADMIN");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());

        User saved = captor.getValue();
        assertThat(saved.getFullName()).isEqualTo("Alice");
        assertThat(saved.getRole()).isEqualTo(RoleName.SUPER_ADMIN);
    }

    @Test
    void initProfile_unknownRole_defaultsToStudent() {
        UUID userId = UUID.randomUUID();
        User user = buildUser(userId, RoleName.STUDENT);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        userProfileService.initProfile(userId, "Bob", "JEDI_MASTER");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getRole()).isEqualTo(RoleName.STUDENT);
    }

    @Test
    void initProfile_userNotFound_throwsEntityNotFoundException() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userProfileService.initProfile(userId, "Bob", "STUDENT"))
            .isInstanceOf(EntityNotFoundException.class);
    }

    // -----------------------------------------------------------------------
    // getMyProfile
    // -----------------------------------------------------------------------

    @Test
    void getMyProfile_found_returnsUser() {
        UUID userId = UUID.randomUUID();
        User user = buildUser(userId, RoleName.STUDENT);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        assertThat(userProfileService.getMyProfile(userId)).isSameAs(user);
    }

    @Test
    void getMyProfile_notFound_throwsEntityNotFoundException() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userProfileService.getMyProfile(userId))
            .isInstanceOf(EntityNotFoundException.class);
    }

    // -----------------------------------------------------------------------
    // updateMyProfile
    // -----------------------------------------------------------------------

    @Test
    void updateMyProfile_partialUpdate_onlyChangesSuppliedFields() {
        UUID userId = UUID.randomUUID();
        User user = buildUser(userId, RoleName.STUDENT);
        user.setFullName("Old Name");
        user.setPhone("111");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        UpdateProfileRequest dto = new UpdateProfileRequest();
        dto.setFullName("New Name");

        User result = userProfileService.updateMyProfile(userId, dto);

        assertThat(result.getFullName()).isEqualTo("New Name");
        assertThat(result.getPhone()).isEqualTo("111"); // unchanged
    }

    @Test
    void updateMyProfile_learningGoals_convertsListToArray() {
        UUID userId = UUID.randomUUID();
        User user = buildUser(userId, RoleName.STUDENT);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        UpdateProfileRequest dto = new UpdateProfileRequest();
        dto.setLearningGoals(List.of("Java", "Spring"));

        User result = userProfileService.updateMyProfile(userId, dto);

        assertThat(result.getLearningGoals()).containsExactly("Java", "Spring");
    }

    @Test
    void updateMyProfile_newFields_areSaved() {
        UUID userId = UUID.randomUUID();
        User user = buildUser(userId, RoleName.STUDENT);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        UpdateProfileRequest dto = new UpdateProfileRequest();
        dto.setAvatarUrl("https://example.com/avatar.png");
        dto.setDateOfBirth(LocalDate.of(2000, 1, 1));
        dto.setPreferences(Map.of("courseUpdates", true));

        User result = userProfileService.updateMyProfile(userId, dto);

        assertThat(result.getAvatarUrl()).isEqualTo("https://example.com/avatar.png");
        assertThat(result.getDateOfBirth()).isEqualTo(LocalDate.of(2000, 1, 1));
        assertThat(result.getPreferences()).containsEntry("courseUpdates", true);
    }

    // -----------------------------------------------------------------------
    // changePassword
    // -----------------------------------------------------------------------

    @Test
    void changePassword_correctCurrentPassword_updatesHash() {
        UUID userId = UUID.randomUUID();
        User user = buildUser(userId, RoleName.STUDENT);
        user.setPasswordHash("old-hash");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("oldPass1", "old-hash")).thenReturn(true);
        when(passwordEncoder.encode("NewPass1")).thenReturn("new-hash");
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        userProfileService.changePassword(userId, "oldPass1", "NewPass1");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getPasswordHash()).isEqualTo("new-hash");
    }

    @Test
    void changePassword_wrongCurrentPassword_throwsInvalidPasswordException() {
        UUID userId = UUID.randomUUID();
        User user = buildUser(userId, RoleName.STUDENT);
        user.setPasswordHash("old-hash");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrongPass", "old-hash")).thenReturn(false);

        assertThatThrownBy(() -> userProfileService.changePassword(userId, "wrongPass", "NewPass1"))
            .isInstanceOf(InvalidPasswordException.class);
        verify(userRepository, never()).save(any());
    }

    @Test
    void changePassword_weakNewPassword_throwsInvalidPasswordException() {
        UUID userId = UUID.randomUUID();
        User user = buildUser(userId, RoleName.STUDENT);
        user.setPasswordHash("old-hash");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("oldPass1", "old-hash")).thenReturn(true);

        assertThatThrownBy(() -> userProfileService.changePassword(userId, "oldPass1", "weak"))
            .isInstanceOf(InvalidPasswordException.class);
        verify(userRepository, never()).save(any());
    }

    // -----------------------------------------------------------------------
    // getAllUsers
    // -----------------------------------------------------------------------

    // getAllUsers is now built on Specification (see UserProfileService — a static JPQL
    // "(:x IS NULL OR field = :x)" clause fails outright for the native-enum `status` column when
    // :x is null). Specification predicates are lambdas, not easily asserted by content with plain
    // Mockito, so these tests confirm delegation and pass-through of results rather than the exact
    // predicate shape — the predicate shape itself is covered by the live/integration verification
    // in PLAN.md Task 29.

    @Test
    void getAllUsers_returnsRepositoryPageContentAndMetadata() {
        User u = buildUser(UUID.randomUUID(), RoleName.STUDENT);
        when(userRepository.findAll(any(Specification.class), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(u)));

        Map<String, Object> result = userProfileService.getAllUsers(null, null, null, 1, 20);

        List<?> data = (List<?>) result.get("data");
        assertThat(data).hasSize(1);
        assertThat(data.get(0)).isEqualTo(u);
        assertThat(result.get("total")).isEqualTo(1L);
        assertThat(result.get("page")).isEqualTo(1);
        assertThat(result.get("limit")).isEqualTo(20);
    }

    @Test
    void getAllUsers_blankQuery_stillDelegatesToRepository() {
        when(userRepository.findAll(any(Specification.class), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of()));

        Map<String, Object> result = userProfileService.getAllUsers("   ", null, null, 1, 20);

        assertThat((List<?>) result.get("data")).isEmpty();
    }

    @Test
    void getAllUsers_withQuery_delegatesToRepository() {
        User u = buildUser(UUID.randomUUID(), RoleName.STUDENT);
        when(userRepository.findAll(any(Specification.class), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(u)));

        Map<String, Object> result = userProfileService.getAllUsers("jane", null, null, 1, 20);

        List<?> data = (List<?>) result.get("data");
        assertThat(data).hasSize(1);
        assertThat(data.get(0)).isEqualTo(u);
    }

    @Test
    void getAllUsers_roleFilter_delegatesToRepository() {
        User u = buildUser(UUID.randomUUID(), RoleName.STUDENT);
        when(userRepository.findAll(any(Specification.class), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(u)));

        Map<String, Object> result = userProfileService.getAllUsers(null, "STUDENT", null, 1, 20);

        List<?> data = (List<?>) result.get("data");
        assertThat(data).hasSize(1);
        assertThat(data.get(0)).isEqualTo(u);
    }

    @Test
    void getAllUsers_invalidRole_treatedAsNoFilter_stillDelegates() {
        when(userRepository.findAll(any(Specification.class), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of()));

        Map<String, Object> result = userProfileService.getAllUsers(null, "NOT_A_ROLE", null, 1, 20);

        assertThat((List<?>) result.get("data")).isEmpty();
    }

    // -----------------------------------------------------------------------
    // getUserById
    // -----------------------------------------------------------------------

    @Test
    void getUserById_found_returnsUser() {
        UUID id = UUID.randomUUID();
        User user = buildUser(id, RoleName.MODERATOR);
        when(userRepository.findById(id)).thenReturn(Optional.of(user));

        assertThat(userProfileService.getUserById(id)).isSameAs(user);
    }

    @Test
    void getUserById_notFound_throwsEntityNotFoundException() {
        UUID id = UUID.randomUUID();
        when(userRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userProfileService.getUserById(id))
            .isInstanceOf(EntityNotFoundException.class);
    }

    // -----------------------------------------------------------------------
    // updateUserStatus
    // -----------------------------------------------------------------------

    @Test
    void updateUserStatus_validStatus_updatesAndSaves() {
        UUID userId = UUID.randomUUID();
        User user = buildUser(userId, RoleName.STUDENT);
        user.setStatus(User.Status.ACTIVE);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User result = userProfileService.updateUserStatus(userId, "SUSPENDED");

        assertThat(result.getStatus()).isEqualTo(User.Status.SUSPENDED);
    }

    @Test
    void updateUserStatus_invalidStatus_throwsIllegalArgumentException() {
        UUID userId = UUID.randomUUID();
        User user = buildUser(userId, RoleName.STUDENT);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> userProfileService.updateUserStatus(userId, "FLYING"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private User buildUser(UUID id, RoleName role) {
        User u = new User();
        u.setId(id);
        u.setEmail("test@example.com");
        u.setPasswordHash("hashed");
        u.setStatus(User.Status.ACTIVE);
        u.setRole(role);
        return u;
    }
}
