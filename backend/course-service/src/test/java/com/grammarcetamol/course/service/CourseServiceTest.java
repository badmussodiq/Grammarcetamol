package com.grammarcetamol.course.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.grammarcetamol.shared.config.CurrentUser;
import com.grammarcetamol.course.dto.CreateCourseRequest;
import com.grammarcetamol.course.entity.Course;
import com.grammarcetamol.course.entity.CourseModule;
import com.grammarcetamol.course.entity.Lesson;
import com.grammarcetamol.course.exception.CourseDeletionBlockedException;
import com.grammarcetamol.course.exception.CoursePublishValidationException;
import com.grammarcetamol.shared.exception.ForbiddenException;
import com.grammarcetamol.course.repository.CategoryRepository;
import com.grammarcetamol.course.repository.CourseModuleRepository;
import com.grammarcetamol.course.repository.CourseRepository;
import com.grammarcetamol.course.repository.CourseVersionRepository;
import com.grammarcetamol.course.repository.LessonRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseServiceTest {

    @Mock
    private CourseRepository courseRepository;
    @Mock
    private CourseModuleRepository moduleRepository;
    @Mock
    private LessonRepository lessonRepository;
    @Mock
    private CourseVersionRepository versionRepository;
    @Mock
    private CategoryRepository categoryRepository;
    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private CourseService courseService;

    private static final CurrentUser SUPER_ADMIN = new CurrentUser(UUID.randomUUID(), Set.of("SUPER_ADMIN"));
    private static final CurrentUser STUDENT = new CurrentUser(UUID.randomUUID(), Set.of("STUDENT"));

    // -----------------------------------------------------------------------
    // publish — validation
    // -----------------------------------------------------------------------

    @Test
    void publish_missingCoverImageAndNoModules_reportsBothErrors() {
        Course course = readyCourse();
        course.setCoverImageUrl(null);
        when(courseRepository.findById(course.getId())).thenReturn(Optional.of(course));
        when(moduleRepository.findByCourseIdOrderByPositionAsc(course.getId())).thenReturn(List.of());

        assertThatThrownBy(() -> courseService.publish(course.getId(), SUPER_ADMIN))
                .isInstanceOf(CoursePublishValidationException.class)
                .satisfies(ex -> {
                    List<String> errors = ((CoursePublishValidationException) ex).getErrors();
                    assertThat(errors).contains("Cover image is required", "At least one module is required");
                });
    }

    @Test
    void publish_moduleWithNoLessons_reportsError() {
        Course course = readyCourse();
        CourseModule module = module(course.getId());
        when(courseRepository.findById(course.getId())).thenReturn(Optional.of(course));
        when(moduleRepository.findByCourseIdOrderByPositionAsc(course.getId())).thenReturn(List.of(module));
        when(lessonRepository.countByModuleIdIn(List.of(module.getId()))).thenReturn(0L);
        when(lessonRepository.countByModuleIdInAndTypeAndVideoUrlIsNull(List.of(module.getId()), Lesson.TYPE_VIDEO)).thenReturn(0L);

        assertThatThrownBy(() -> courseService.publish(course.getId(), SUPER_ADMIN))
                .isInstanceOf(CoursePublishValidationException.class)
                .satisfies(ex -> assertThat(((CoursePublishValidationException) ex).getErrors())
                        .contains("At least one lesson is required"));
    }

    @Test
    void publish_videoLessonMissingUrl_reportsError() {
        Course course = readyCourse();
        CourseModule module = module(course.getId());
        when(courseRepository.findById(course.getId())).thenReturn(Optional.of(course));
        when(moduleRepository.findByCourseIdOrderByPositionAsc(course.getId())).thenReturn(List.of(module));
        when(lessonRepository.countByModuleIdIn(List.of(module.getId()))).thenReturn(2L);
        when(lessonRepository.countByModuleIdInAndTypeAndVideoUrlIsNull(List.of(module.getId()), Lesson.TYPE_VIDEO)).thenReturn(1L);

        assertThatThrownBy(() -> courseService.publish(course.getId(), SUPER_ADMIN))
                .isInstanceOf(CoursePublishValidationException.class)
                .satisfies(ex -> assertThat(((CoursePublishValidationException) ex).getErrors())
                        .anyMatch(e -> e.contains("missing a video URL")));
    }

    @Test
    void publish_everythingPresent_transitionsToPublished() {
        Course course = readyCourse();
        CourseModule module = module(course.getId());
        when(courseRepository.findById(course.getId())).thenReturn(Optional.of(course));
        when(moduleRepository.findByCourseIdOrderByPositionAsc(course.getId())).thenReturn(List.of(module));
        when(lessonRepository.countByModuleIdIn(List.of(module.getId()))).thenReturn(1L);
        when(lessonRepository.countByModuleIdInAndTypeAndVideoUrlIsNull(List.of(module.getId()), Lesson.TYPE_VIDEO)).thenReturn(0L);
        when(courseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Course result = courseService.publish(course.getId(), SUPER_ADMIN);

        assertThat(result.getStatus()).isEqualTo(Course.STATUS_PUBLISHED);
        assertThat(result.getPublishedAt()).isNotNull();
    }

    @Test
    void publish_notOwnerNotSuperAdmin_throwsForbidden() {
        Course course = readyCourse();
        when(courseRepository.findById(course.getId())).thenReturn(Optional.of(course));

        assertThatThrownBy(() -> courseService.publish(course.getId(), STUDENT))
                .isInstanceOf(ForbiddenException.class);
    }

    // -----------------------------------------------------------------------
    // delete — enrollment guard
    // -----------------------------------------------------------------------

    @Test
    void delete_withActiveEnrollments_throwsDeletionBlocked() {
        Course course = readyCourse();
        course.setEnrollmentCount(3);
        when(courseRepository.findById(course.getId())).thenReturn(Optional.of(course));

        assertThatThrownBy(() -> courseService.delete(course.getId(), SUPER_ADMIN))
                .isInstanceOf(CourseDeletionBlockedException.class);
    }

    @Test
    void delete_zeroEnrollments_deletesSuccessfully() {
        Course course = readyCourse();
        course.setEnrollmentCount(0);
        when(courseRepository.findById(course.getId())).thenReturn(Optional.of(course));

        courseService.delete(course.getId(), SUPER_ADMIN);

        org.mockito.Mockito.verify(courseRepository).delete(course);
    }

    @Test
    void delete_courseNotFound_throwsEntityNotFound() {
        UUID id = UUID.randomUUID();
        when(courseRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> courseService.delete(id, SUPER_ADMIN))
                .isInstanceOf(EntityNotFoundException.class);
    }

    // -----------------------------------------------------------------------
    // create
    // -----------------------------------------------------------------------

    @Test
    void create_nonAdminNonModerator_throwsForbidden() {
        CreateCourseRequest req = new CreateCourseRequest();
        req.setTitle("Test");
        req.setDescription("Desc");
        req.setDifficulty("beginner");
        req.setPrice(BigDecimal.ZERO);
        req.setInstructorName("Jane");

        assertThatThrownBy(() -> courseService.create(req, STUDENT))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void create_slugCollision_appendsSuffix() {
        CreateCourseRequest req = new CreateCourseRequest();
        req.setTitle("English Basics");
        req.setDescription("Desc");
        req.setDifficulty("beginner");
        req.setPrice(BigDecimal.ZERO);
        req.setInstructorName("Jane");

        when(courseRepository.existsBySlug("english-basics")).thenReturn(true);
        when(courseRepository.existsBySlug("english-basics-2")).thenReturn(false);
        when(courseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Course created = courseService.create(req, SUPER_ADMIN);

        assertThat(created.getSlug()).isEqualTo("english-basics-2");
        assertThat(created.getInstructorId()).isEqualTo(SUPER_ADMIN.id());
        assertThat(created.getStatus()).isEqualTo(Course.STATUS_DRAFT);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private Course readyCourse() {
        Course course = new Course();
        course.setId(UUID.randomUUID());
        course.setInstructorId(SUPER_ADMIN.id());
        course.setCoverImageUrl("https://example.com/cover.png");
        course.setPrice(BigDecimal.ZERO);
        course.setStatus(Course.STATUS_DRAFT);
        course.setEnrollmentCount(0);
        return course;
    }

    private CourseModule module(UUID courseId) {
        CourseModule module = new CourseModule();
        module.setId(UUID.randomUUID());
        module.setCourseId(courseId);
        return module;
    }
}
