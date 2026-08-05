package com.grammarcetamol.course.service;

import com.grammarcetamol.shared.config.CurrentUser;
import com.grammarcetamol.course.dto.ReorderRequest;
import com.grammarcetamol.course.entity.Course;
import com.grammarcetamol.course.entity.CourseModule;
import com.grammarcetamol.shared.exception.ForbiddenException;
import com.grammarcetamol.course.repository.CourseModuleRepository;
import com.grammarcetamol.course.repository.CourseRepository;
import com.grammarcetamol.course.repository.LessonRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseStructureServiceTest {

    @Mock private CourseRepository courseRepository;
    @Mock private CourseModuleRepository moduleRepository;
    @Mock private LessonRepository lessonRepository;

    @InjectMocks
    private CourseStructureService structureService;

    private static final CurrentUser OWNER = new CurrentUser(UUID.randomUUID(), Set.of("MODERATOR"));
    private static final CurrentUser OTHER_MODERATOR = new CurrentUser(UUID.randomUUID(), Set.of("MODERATOR"));

    @Test
    void reorderModules_validPermutation_appliesNewPositions() {
        Course course = ownedCourse();
        CourseModule m1 = module(course.getId(), 0);
        CourseModule m2 = module(course.getId(), 1);
        when(courseRepository.findById(course.getId())).thenReturn(Optional.of(course));
        when(moduleRepository.findByCourseIdOrderByPositionAsc(course.getId())).thenReturn(List.of(m1, m2));

        ReorderRequest req = new ReorderRequest();
        req.setOrderedIds(List.of(m2.getId(), m1.getId()));

        structureService.reorderModules(course.getId(), req, OWNER);

        ArgumentCaptor<List<CourseModule>> captor = ArgumentCaptor.forClass(List.class);
        verify(moduleRepository).saveAll(captor.capture());
        List<CourseModule> saved = captor.getValue();
        assertThat(saved).extracting(CourseModule::getId, CourseModule::getPosition)
            .containsExactlyInAnyOrder(
                org.assertj.core.groups.Tuple.tuple(m2.getId(), 0),
                org.assertj.core.groups.Tuple.tuple(m1.getId(), 1)
            );
    }

    @Test
    void reorderModules_missingAnId_throwsIllegalArgument() {
        Course course = ownedCourse();
        CourseModule m1 = module(course.getId(), 0);
        CourseModule m2 = module(course.getId(), 1);
        when(courseRepository.findById(course.getId())).thenReturn(Optional.of(course));
        when(moduleRepository.findByCourseIdOrderByPositionAsc(course.getId())).thenReturn(List.of(m1, m2));

        ReorderRequest req = new ReorderRequest();
        req.setOrderedIds(List.of(m1.getId())); // missing m2

        assertThatThrownBy(() -> structureService.reorderModules(course.getId(), req, OWNER))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void reorderModules_notOwnerNotSuperAdmin_throwsForbidden() {
        Course course = ownedCourse();
        when(courseRepository.findById(course.getId())).thenReturn(Optional.of(course));

        ReorderRequest req = new ReorderRequest();
        req.setOrderedIds(List.of(UUID.randomUUID()));

        assertThatThrownBy(() -> structureService.reorderModules(course.getId(), req, OTHER_MODERATOR))
            .isInstanceOf(ForbiddenException.class);
    }

    private Course ownedCourse() {
        Course course = new Course();
        course.setId(UUID.randomUUID());
        course.setInstructorId(OWNER.id());
        return course;
    }

    private CourseModule module(UUID courseId, int position) {
        CourseModule module = new CourseModule();
        module.setId(UUID.randomUUID());
        module.setCourseId(courseId);
        module.setPosition(position);
        return module;
    }
}
