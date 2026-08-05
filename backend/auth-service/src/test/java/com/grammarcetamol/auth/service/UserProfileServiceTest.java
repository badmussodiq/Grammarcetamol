package com.grammarcetamol.auth.service;

import com.grammarcetamol.auth.dto.UpdateProfileRequest;
import com.grammarcetamol.auth.entity.RoleName;
import com.grammarcetamol.auth.entity.User;
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

    // -----------------------------------------------------------------------
    // getAllUsers
    // -----------------------------------------------------------------------

    @Test
    void getAllUsers_nullQuery_usesFindAllNotSearch() {
        User u = buildUser(UUID.randomUUID(), RoleName.STUDENT);
        when(userRepository.findAll(any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(u)));

        Map<String, Object> result = userProfileService.getAllUsers(null, 1, 20);

        assertThat((List<?>) result.get("data")).hasSize(1);
        assertThat(result.get("total")).isEqualTo(1L);
        verify(userRepository, never()).search(any(), any());
    }

    @Test
    void getAllUsers_blankQuery_usesFindAllNotSearch() {
        when(userRepository.findAll(any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of()));

        userProfileService.getAllUsers("   ", 1, 20);

        verify(userRepository, never()).search(any(), any());
    }

    @Test
    void getAllUsers_withQuery_usesSearchNotFindAll() {
        User u = buildUser(UUID.randomUUID(), RoleName.STUDENT);
        when(userRepository.search(eq("jane"), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(u)));

        Map<String, Object> result = userProfileService.getAllUsers("jane", 1, 20);

        assertThat((List<?>) result.get("data")).hasSize(1);
        verify(userRepository, never()).findAll(any(Pageable.class));
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
