package com.grammarcetamol.course.controller;

import com.grammarcetamol.shared.config.CurrentUser;
import com.grammarcetamol.shared.dto.ApiResponse;
import com.grammarcetamol.course.dto.CourseDetailResponse;
import com.grammarcetamol.course.dto.CreateCourseRequest;
import com.grammarcetamol.course.dto.UpdateCourseRequest;
import com.grammarcetamol.course.entity.Course;
import com.grammarcetamol.course.entity.CourseVersion;
import com.grammarcetamol.course.service.CourseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class CourseController {

    private final CourseService courseService;

    @GetMapping
    public ApiResponse<Map<String, Object>> browse(@RequestParam(required = false) String category,
                                                     @RequestParam(required = false) String difficulty,
                                                     @RequestParam(required = false) String price,
                                                     @RequestParam(required = false) String q,
                                                     @RequestParam(required = false) String status,
                                                     @RequestParam(required = false) String sort,
                                                     @RequestParam(defaultValue = "1") int page,
                                                     @RequestParam(defaultValue = "20") int limit,
                                                     CurrentUser currentUser) {
        Page<Course> result = courseService.browse(category, difficulty, price, q, status, sort, page, limit, currentUser);
        return ApiResponse.success(pageBody(result));
    }

    @GetMapping("/featured")
    public ApiResponse<List<Course>> featured(@RequestParam(defaultValue = "6") int limit) {
        return ApiResponse.success(courseService.featured(limit));
    }

    @GetMapping("/{slugOrId}")
    public ApiResponse<CourseDetailResponse> detail(@PathVariable String slugOrId, CurrentUser currentUser) {
        return ApiResponse.success(courseService.getDetail(slugOrId, currentUser));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Course>> create(@Valid @RequestBody CreateCourseRequest request,
                                                        CurrentUser currentUser) {
        Course created = courseService.create(request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(created));
    }

    @PatchMapping("/{id}")
    public ApiResponse<Course> update(@PathVariable UUID id, @RequestBody UpdateCourseRequest request,
                                       CurrentUser currentUser) {
        return ApiResponse.success(courseService.update(id, request, currentUser));
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<Course> publish(@PathVariable UUID id, CurrentUser currentUser) {
        return ApiResponse.success(courseService.publish(id, currentUser));
    }

    @PostMapping("/{id}/archive")
    public ApiResponse<Course> archive(@PathVariable UUID id, CurrentUser currentUser) {
        return ApiResponse.success(courseService.archive(id, currentUser));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, CurrentUser currentUser) {
        courseService.delete(id, currentUser);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/versions")
    public ApiResponse<List<CourseVersion>> versions(@PathVariable UUID id, CurrentUser currentUser) {
        return ApiResponse.success(courseService.getVersions(id, currentUser));
    }

    @PostMapping("/{id}/versions/{versionId}/restore")
    public ApiResponse<Course> restoreVersion(@PathVariable UUID id, @PathVariable UUID versionId,
                                               CurrentUser currentUser) {
        return ApiResponse.success(courseService.restoreVersion(id, versionId, currentUser));
    }

    private Map<String, Object> pageBody(Page<Course> result) {
        return Map.of(
            "items", result.getContent(),
            "page", result.getNumber() + 1,
            "limit", result.getSize(),
            "total", result.getTotalElements(),
            "totalPages", result.getTotalPages()
        );
    }
}
