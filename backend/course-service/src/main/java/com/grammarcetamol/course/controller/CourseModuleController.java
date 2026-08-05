package com.grammarcetamol.course.controller;

import com.grammarcetamol.course.config.CurrentUser;
import com.grammarcetamol.course.dto.ApiResponse;
import com.grammarcetamol.course.dto.CreateLessonRequest;
import com.grammarcetamol.course.dto.CreateModuleRequest;
import com.grammarcetamol.course.dto.ReorderRequest;
import com.grammarcetamol.course.dto.UpdateLessonRequest;
import com.grammarcetamol.course.dto.UpdateModuleRequest;
import com.grammarcetamol.course.entity.CourseModule;
import com.grammarcetamol.course.entity.Lesson;
import com.grammarcetamol.course.service.CourseStructureService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/courses/{courseId}/modules")
@RequiredArgsConstructor
public class CourseModuleController {

    private final CourseStructureService structureService;

    @GetMapping
    public ApiResponse<List<CourseModule>> list(@PathVariable UUID courseId) {
        return ApiResponse.success(structureService.listModules(courseId));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CourseModule>> create(@PathVariable UUID courseId,
                                                              @Valid @RequestBody CreateModuleRequest request,
                                                              CurrentUser currentUser) {
        CourseModule created = structureService.createModule(courseId, request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(created));
    }

    @PatchMapping("/{moduleId}")
    public ApiResponse<CourseModule> update(@PathVariable UUID courseId, @PathVariable UUID moduleId,
                                             @RequestBody UpdateModuleRequest request, CurrentUser currentUser) {
        return ApiResponse.success(structureService.updateModule(courseId, moduleId, request, currentUser));
    }

    @DeleteMapping("/{moduleId}")
    public ResponseEntity<Void> delete(@PathVariable UUID courseId, @PathVariable UUID moduleId,
                                        CurrentUser currentUser) {
        structureService.deleteModule(courseId, moduleId, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/reorder")
    public ResponseEntity<Void> reorder(@PathVariable UUID courseId, @Valid @RequestBody ReorderRequest request,
                                         CurrentUser currentUser) {
        structureService.reorderModules(courseId, request, currentUser);
        return ResponseEntity.noContent().build();
    }

    // -------------------------------------------------------------------
    // Lessons (nested under a module)
    // -------------------------------------------------------------------

    @GetMapping("/{moduleId}/lessons")
    public ApiResponse<List<Lesson>> listLessons(@PathVariable UUID courseId, @PathVariable UUID moduleId) {
        return ApiResponse.success(structureService.listLessons(courseId, moduleId));
    }

    @PostMapping("/{moduleId}/lessons")
    public ResponseEntity<ApiResponse<Lesson>> createLesson(@PathVariable UUID courseId, @PathVariable UUID moduleId,
                                                              @Valid @RequestBody CreateLessonRequest request,
                                                              CurrentUser currentUser) {
        Lesson created = structureService.createLesson(courseId, moduleId, request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(created));
    }

    @PatchMapping("/{moduleId}/lessons/{lessonId}")
    public ApiResponse<Lesson> updateLesson(@PathVariable UUID courseId, @PathVariable UUID moduleId,
                                             @PathVariable UUID lessonId, @RequestBody UpdateLessonRequest request,
                                             CurrentUser currentUser) {
        return ApiResponse.success(structureService.updateLesson(courseId, moduleId, lessonId, request, currentUser));
    }

    @DeleteMapping("/{moduleId}/lessons/{lessonId}")
    public ResponseEntity<Void> deleteLesson(@PathVariable UUID courseId, @PathVariable UUID moduleId,
                                              @PathVariable UUID lessonId, CurrentUser currentUser) {
        structureService.deleteLesson(courseId, moduleId, lessonId, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{moduleId}/lessons/reorder")
    public ResponseEntity<Void> reorderLessons(@PathVariable UUID courseId, @PathVariable UUID moduleId,
                                                @Valid @RequestBody ReorderRequest request, CurrentUser currentUser) {
        structureService.reorderLessons(courseId, moduleId, request, currentUser);
        return ResponseEntity.noContent().build();
    }
}
