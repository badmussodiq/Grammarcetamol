package com.grammarcetamol.course.service;

import com.grammarcetamol.shared.config.CurrentUser;
import com.grammarcetamol.course.dto.CreateLessonRequest;
import com.grammarcetamol.course.dto.CreateModuleRequest;
import com.grammarcetamol.course.dto.ReorderRequest;
import com.grammarcetamol.course.dto.UpdateLessonRequest;
import com.grammarcetamol.course.dto.UpdateModuleRequest;
import com.grammarcetamol.course.entity.Course;
import com.grammarcetamol.course.entity.CourseModule;
import com.grammarcetamol.course.entity.Lesson;
import com.grammarcetamol.shared.exception.ForbiddenException;
import com.grammarcetamol.course.repository.CourseModuleRepository;
import com.grammarcetamol.course.repository.CourseRepository;
import com.grammarcetamol.course.repository.LessonRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CourseStructureService {

    private final CourseRepository courseRepository;
    private final CourseModuleRepository moduleRepository;
    private final LessonRepository lessonRepository;

    // -------------------------------------------------------------------
    // Modules
    // -------------------------------------------------------------------

    public List<CourseModule> listModules(UUID courseId) {
        return moduleRepository.findByCourseIdOrderByPositionAsc(courseId);
    }

    @Transactional
    public CourseModule createModule(UUID courseId, CreateModuleRequest request, CurrentUser currentUser) {
        Course course = getOwnedCourse(courseId, currentUser);
        CourseModule module = new CourseModule();
        module.setCourseId(course.getId());
        module.setTitle(request.getTitle());
        module.setDescription(request.getDescription());
        module.setPosition((int) moduleRepository.countByCourseId(course.getId()));
        return moduleRepository.save(module);
    }

    @Transactional
    public CourseModule updateModule(UUID courseId, UUID moduleId, UpdateModuleRequest request, CurrentUser currentUser) {
        Course course = getOwnedCourse(courseId, currentUser);
        CourseModule module = getModuleInCourse(course.getId(), moduleId);
        if (request.getTitle() != null) module.setTitle(request.getTitle());
        if (request.getDescription() != null) module.setDescription(request.getDescription());
        if (request.getPublished() != null) module.setPublished(request.getPublished());
        return moduleRepository.save(module);
    }

    @Transactional
    public void deleteModule(UUID courseId, UUID moduleId, CurrentUser currentUser) {
        Course course = getOwnedCourse(courseId, currentUser);
        CourseModule module = getModuleInCourse(course.getId(), moduleId);
        moduleRepository.delete(module);
    }

    @Transactional
    public void reorderModules(UUID courseId, ReorderRequest request, CurrentUser currentUser) {
        Course course = getOwnedCourse(courseId, currentUser);
        List<CourseModule> modules = moduleRepository.findByCourseIdOrderByPositionAsc(course.getId());
        applyOrder(modules, request.getOrderedIds(), CourseModule::getId, CourseModule::setPosition);
        moduleRepository.saveAll(modules);
    }

    // -------------------------------------------------------------------
    // Lessons
    // -------------------------------------------------------------------

    public List<Lesson> listLessons(UUID courseId, UUID moduleId) {
        CourseModule module = getModuleInCourse(courseId, moduleId);
        return lessonRepository.findByModuleIdOrderByPositionAsc(module.getId());
    }

    @Transactional
    public Lesson createLesson(UUID courseId, UUID moduleId, CreateLessonRequest request, CurrentUser currentUser) {
        Course course = getOwnedCourse(courseId, currentUser);
        CourseModule module = getModuleInCourse(course.getId(), moduleId);

        Lesson lesson = new Lesson();
        lesson.setModuleId(module.getId());
        lesson.setTitle(request.getTitle());
        lesson.setDescription(request.getDescription());
        lesson.setType(request.getType() == null || request.getType().isBlank() ? Lesson.TYPE_VIDEO : request.getType());
        lesson.setDuration(request.getDuration());
        lesson.setVideoUrl(request.getVideoUrl());
        lesson.setUploadFileId(request.getUploadFileId());
        lesson.setAllowDownload(request.isAllowDownload());
        lesson.setPreview(request.isPreview());
        lesson.setPublished(request.isPublished());
        lesson.setPosition(lessonRepository.findByModuleIdOrderByPositionAsc(module.getId()).size());
        return lessonRepository.save(lesson);
    }

    @Transactional
    public Lesson updateLesson(UUID courseId, UUID moduleId, UUID lessonId, UpdateLessonRequest request, CurrentUser currentUser) {
        Course course = getOwnedCourse(courseId, currentUser);
        CourseModule module = getModuleInCourse(course.getId(), moduleId);
        Lesson lesson = getLessonInModule(module.getId(), lessonId);

        if (request.getTitle() != null) lesson.setTitle(request.getTitle());
        if (request.getDescription() != null) lesson.setDescription(request.getDescription());
        if (request.getType() != null) lesson.setType(request.getType());
        if (request.getDuration() != null) lesson.setDuration(request.getDuration());
        if (request.getVideoUrl() != null) lesson.setVideoUrl(request.getVideoUrl());
        if (request.getUploadFileId() != null) lesson.setUploadFileId(request.getUploadFileId());
        if (request.getAllowDownload() != null) lesson.setAllowDownload(request.getAllowDownload());
        if (request.getPreview() != null) lesson.setPreview(request.getPreview());
        if (request.getPublished() != null) lesson.setPublished(request.getPublished());
        return lessonRepository.save(lesson);
    }

    @Transactional
    public void deleteLesson(UUID courseId, UUID moduleId, UUID lessonId, CurrentUser currentUser) {
        Course course = getOwnedCourse(courseId, currentUser);
        CourseModule module = getModuleInCourse(course.getId(), moduleId);
        Lesson lesson = getLessonInModule(module.getId(), lessonId);
        lessonRepository.delete(lesson);
    }

    @Transactional
    public void reorderLessons(UUID courseId, UUID moduleId, ReorderRequest request, CurrentUser currentUser) {
        Course course = getOwnedCourse(courseId, currentUser);
        CourseModule module = getModuleInCourse(course.getId(), moduleId);
        List<Lesson> lessons = lessonRepository.findByModuleIdOrderByPositionAsc(module.getId());
        applyOrder(lessons, request.getOrderedIds(), Lesson::getId, Lesson::setPosition);
        lessonRepository.saveAll(lessons);
    }

    // -------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------

    private Course getOwnedCourse(UUID courseId, CurrentUser currentUser) {
        Course course = courseRepository.findById(courseId)
            .orElseThrow(() -> new EntityNotFoundException("Course not found"));
        if (!currentUser.canModify(course.getInstructorId())) {
            throw new ForbiddenException("You do not have permission to modify this course");
        }
        return course;
    }

    private CourseModule getModuleInCourse(UUID courseId, UUID moduleId) {
        CourseModule module = moduleRepository.findById(moduleId)
            .orElseThrow(() -> new EntityNotFoundException("Module not found"));
        if (!module.getCourseId().equals(courseId)) {
            throw new EntityNotFoundException("Module not found");
        }
        return module;
    }

    private Lesson getLessonInModule(UUID moduleId, UUID lessonId) {
        Lesson lesson = lessonRepository.findById(lessonId)
            .orElseThrow(() -> new EntityNotFoundException("Lesson not found"));
        if (!lesson.getModuleId().equals(moduleId)) {
            throw new EntityNotFoundException("Lesson not found");
        }
        return lesson;
    }

    private <T> void applyOrder(List<T> items, List<UUID> orderedIds,
                                 Function<T, UUID> idFn, BiConsumer<T, Integer> positionSetter) {
        boolean sameSet = orderedIds.size() == items.size()
            && new HashSet<>(orderedIds).containsAll(items.stream().map(idFn).toList());
        if (!sameSet) {
            throw new IllegalArgumentException("orderedIds must contain exactly the current set of ids");
        }
        Map<UUID, T> byId = items.stream().collect(Collectors.toMap(idFn, Function.identity()));
        for (int i = 0; i < orderedIds.size(); i++) {
            positionSetter.accept(byId.get(orderedIds.get(i)), i);
        }
    }
}
