package com.grammarcetamol.enrollment.controller;

import com.grammarcetamol.enrollment.dto.AtRiskEnrollmentResponse;
import com.grammarcetamol.enrollment.dto.CompletionResponse;
import com.grammarcetamol.enrollment.dto.EnrollRequest;
import com.grammarcetamol.enrollment.dto.LearnResponse;
import com.grammarcetamol.enrollment.dto.ProgressUpdateRequest;
import com.grammarcetamol.enrollment.entity.Enrollment;
import com.grammarcetamol.enrollment.entity.LessonProgress;
import com.grammarcetamol.enrollment.service.EnrollmentService;
import com.grammarcetamol.shared.config.CurrentUser;
import com.grammarcetamol.shared.dto.ApiResponse;
import com.grammarcetamol.shared.exception.ForbiddenException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class EnrollmentController {

    private final EnrollmentService enrollmentService;

    @PostMapping("/api/enrollments")
    public ResponseEntity<ApiResponse<Enrollment>> enroll(@Valid @RequestBody EnrollRequest request,
                                                            CurrentUser currentUser) {
        requireAuthenticated(currentUser);
        Enrollment enrollment = enrollmentService.enrollFree(currentUser.id(), request.courseId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(enrollment));
    }

    @GetMapping("/api/enrollments/mine")
    public ApiResponse<List<Enrollment>> mine(CurrentUser currentUser) {
        requireAuthenticated(currentUser);
        return ApiResponse.success(enrollmentService.getMyEnrollments(currentUser.id()));
    }

    /** Admin/moderator lookup of another student's enrollments — the admin student directory's
     * Enrollments tab. */
    @GetMapping("/api/enrollments/user/{userId}")
    public ApiResponse<List<Enrollment>> forUser(@PathVariable UUID userId, CurrentUser currentUser) {
        if (!currentUser.isAdminOrModerator()) {
            throw new ForbiddenException("Only super admins or moderators can view another user's enrollments");
        }
        return ApiResponse.success(enrollmentService.getMyEnrollments(userId));
    }

    @GetMapping("/api/enrollments/course/{courseId}/learn")
    public ApiResponse<LearnResponse> learn(@PathVariable UUID courseId, CurrentUser currentUser) {
        requireAuthenticated(currentUser);
        return ApiResponse.success(enrollmentService.getLearnState(currentUser.id(), courseId));
    }

    @PatchMapping("/api/progress")
    public ApiResponse<LessonProgress> updateProgress(@Valid @RequestBody ProgressUpdateRequest request,
                                                        CurrentUser currentUser) {
        requireAuthenticated(currentUser);
        LessonProgress progress = enrollmentService.updateProgress(
            currentUser.id(), request.courseId(), request.lessonId(), request.currentTime(), request.completed());
        return ApiResponse.success(progress);
    }

    /** Internal — called by review-service (with an elevated role) to check the 50% gate, or a
     * student checking their own completion. */
    @GetMapping("/api/enrollments/completion")
    public ApiResponse<CompletionResponse> completion(@RequestParam UUID userId, @RequestParam UUID courseId,
                                                        CurrentUser currentUser) {
        requireAuthenticated(currentUser);
        if (!currentUser.isAdminOrModerator() && !currentUser.id().equals(userId)) {
            throw new ForbiddenException("You can only check your own completion");
        }
        return ApiResponse.success(enrollmentService.getCompletion(userId, courseId));
    }

    @GetMapping("/api/enrollments/at-risk")
    public ApiResponse<List<AtRiskEnrollmentResponse>> atRisk(CurrentUser currentUser) {
        if (!currentUser.isAdminOrModerator()) {
            throw new ForbiddenException("Only super admins or moderators can view at-risk students");
        }
        return ApiResponse.success(enrollmentService.getAtRisk());
    }

    private void requireAuthenticated(CurrentUser currentUser) {
        if (!currentUser.isAuthenticated()) {
            throw new ForbiddenException("Authentication required");
        }
    }
}
