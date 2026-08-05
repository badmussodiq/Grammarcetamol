package com.grammarcetamol.course.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.grammarcetamol.course.config.CurrentUser;
import com.grammarcetamol.course.dto.*;
import com.grammarcetamol.course.entity.Category;
import com.grammarcetamol.course.entity.Course;
import com.grammarcetamol.course.entity.CourseModule;
import com.grammarcetamol.course.entity.CourseVersion;
import com.grammarcetamol.course.entity.Lesson;
import com.grammarcetamol.course.exception.CourseDeletionBlockedException;
import com.grammarcetamol.course.exception.CoursePublishValidationException;
import com.grammarcetamol.course.exception.ForbiddenException;
import com.grammarcetamol.course.repository.CategoryRepository;
import com.grammarcetamol.course.repository.CourseModuleRepository;
import com.grammarcetamol.course.repository.CourseRepository;
import com.grammarcetamol.course.repository.CourseVersionRepository;
import com.grammarcetamol.course.repository.LessonRepository;
import com.grammarcetamol.course.util.SlugUtil;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CourseService {

    private static final int DEFAULT_PAGE_SIZE = 20;

    private final CourseRepository courseRepository;
    private final CourseModuleRepository moduleRepository;
    private final LessonRepository lessonRepository;
    private final CourseVersionRepository versionRepository;
    private final CategoryRepository categoryRepository;
    private final ObjectMapper objectMapper;

    // -------------------------------------------------------------------
    // Public catalog
    // -------------------------------------------------------------------

    /**
     * Public catalog + admin course list share this one query. Non-admins always get
     * status=published regardless of what they pass — admins/moderators may pass any status,
     * or omit it entirely to see courses in every status (the admin "All" filter).
     */
    public Page<Course> browse(String categorySlug, String difficulty, String price, String q,
                                String status, String sort, int page, int limit, CurrentUser currentUser) {
        UUID categoryId = null;
        if (categorySlug != null && !categorySlug.isBlank()) {
            Optional<Category> category = categoryRepository.findBySlug(categorySlug);
            if (category.isEmpty()) {
                return Page.empty();
            }
            categoryId = category.get().getId();
        }
        String effectiveStatus = currentUser.isAdminOrModerator() ? blankToNull(status) : Course.STATUS_PUBLISHED;
        Pageable pageable = PageRequest.of(Math.max(page - 1, 0), limit > 0 ? limit : DEFAULT_PAGE_SIZE);
        String sortKey = (sort == null || sort.isBlank()) ? "newest" : sort;
        return courseRepository.search(effectiveStatus, categoryId, blankToNull(difficulty),
            blankToNull(price), blankToNull(q), sortKey, pageable);
    }

    public List<Course> featured(int limit) {
        return courseRepository.findTop6ByStatusOrderByEnrollmentCountDesc(Course.STATUS_PUBLISHED)
            .stream().limit(limit > 0 ? limit : 6).toList();
    }

    public CourseDetailResponse getDetail(String slugOrId, CurrentUser currentUser) {
        Course course = findBySlugOrId(slugOrId);
        boolean isOwnerOrAdmin = currentUser.isAdminOrModerator() || currentUser.canModify(course.getInstructorId());

        if (!Course.STATUS_PUBLISHED.equals(course.getStatus()) && !isOwnerOrAdmin) {
            throw new EntityNotFoundException("Course not found");
        }

        List<CourseModule> modules = moduleRepository.findByCourseIdOrderByPositionAsc(course.getId());
        List<UUID> moduleIds = modules.stream().map(CourseModule::getId).toList();
        List<Lesson> lessons = moduleIds.isEmpty()
            ? List.of()
            : lessonRepository.findByModuleIdInOrderByPositionAsc(moduleIds);
        Map<UUID, List<Lesson>> lessonsByModule = lessons.stream()
            .collect(Collectors.groupingBy(Lesson::getModuleId));

        List<ModuleResponse> moduleResponses = modules.stream()
            .map(m -> new ModuleResponse(
                m.getId(), m.getTitle(), m.getDescription(), m.getPosition(), m.isPublished(),
                lessonsByModule.getOrDefault(m.getId(), List.of()).stream()
                    .map(l -> LessonResponse.from(l, l.isPreview() || isOwnerOrAdmin))
                    .toList()))
            .toList();

        return new CourseDetailResponse(course, moduleResponses);
    }

    private Course findBySlugOrId(String slugOrId) {
        Optional<Course> bySlug = courseRepository.findBySlug(slugOrId);
        if (bySlug.isPresent()) {
            return bySlug.get();
        }
        try {
            UUID id = UUID.fromString(slugOrId);
            return courseRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Course not found"));
        } catch (IllegalArgumentException e) {
            throw new EntityNotFoundException("Course not found");
        }
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    // -------------------------------------------------------------------
    // Admin authoring
    // -------------------------------------------------------------------

    @Transactional
    public Course create(CreateCourseRequest request, CurrentUser currentUser) {
        requireAdminOrModerator(currentUser);
        if (request.getCategoryId() != null && !categoryRepository.existsById(request.getCategoryId())) {
            throw new IllegalArgumentException("Unknown category");
        }

        Course course = new Course();
        course.setInstructorId(currentUser.id());
        course.setInstructorName(request.getInstructorName());
        course.setInstructorBio(request.getInstructorBio());
        course.setInstructorAvatarUrl(request.getInstructorAvatarUrl());
        course.setTitle(request.getTitle());
        course.setSubtitle(request.getSubtitle());
        course.setDescription(request.getDescription());
        course.setLearningObjectives(request.getLearningObjectives() == null
            ? new String[0] : request.getLearningObjectives().toArray(new String[0]));
        course.setTargetAudience(request.getTargetAudience());
        course.setPrerequisites(request.getPrerequisites());
        course.setCategoryId(request.getCategoryId());
        course.setDifficulty(request.getDifficulty());
        course.setLanguage(request.getLanguage() == null || request.getLanguage().isBlank() ? "en" : request.getLanguage());
        course.setEstimatedDuration(request.getEstimatedDuration());
        course.setPrice(request.getPrice());
        course.setDiscountPrice(request.getDiscountPrice());
        course.setDiscountExpiresAt(request.getDiscountExpiresAt());
        course.setCurrency(request.getCurrency() == null || request.getCurrency().isBlank() ? "USD" : request.getCurrency());
        course.setCoverImageUrl(request.getCoverImageUrl());
        course.setPromoVideoUrl(request.getPromoVideoUrl());
        course.setStatus(Course.STATUS_DRAFT);
        course.setSlug(generateUniqueSlug(request.getTitle()));
        return courseRepository.save(course);
    }

    private String generateUniqueSlug(String title) {
        String base = SlugUtil.slugify(title);
        String slug = base;
        int suffix = 1;
        while (courseRepository.existsBySlug(slug)) {
            slug = base + "-" + (++suffix);
        }
        return slug;
    }

    @Transactional
    public Course update(UUID courseId, UpdateCourseRequest request, CurrentUser currentUser) {
        Course course = getById(courseId);
        requireCanModify(course, currentUser);

        boolean wasPublished = Course.STATUS_PUBLISHED.equals(course.getStatus());
        if (wasPublished) {
            snapshotVersion(course, currentUser.id(), "Pre-update snapshot");
        }

        if (request.getTitle() != null) course.setTitle(request.getTitle());
        if (request.getSubtitle() != null) course.setSubtitle(request.getSubtitle());
        if (request.getDescription() != null) course.setDescription(request.getDescription());
        if (request.getLearningObjectives() != null) course.setLearningObjectives(request.getLearningObjectives().toArray(new String[0]));
        if (request.getTargetAudience() != null) course.setTargetAudience(request.getTargetAudience());
        if (request.getPrerequisites() != null) course.setPrerequisites(request.getPrerequisites());
        if (request.getCategoryId() != null) course.setCategoryId(request.getCategoryId());
        if (request.getDifficulty() != null) course.setDifficulty(request.getDifficulty());
        if (request.getLanguage() != null) course.setLanguage(request.getLanguage());
        if (request.getEstimatedDuration() != null) course.setEstimatedDuration(request.getEstimatedDuration());
        if (request.getPrice() != null) course.setPrice(request.getPrice());
        if (request.getDiscountPrice() != null) course.setDiscountPrice(request.getDiscountPrice());
        if (request.getDiscountExpiresAt() != null) course.setDiscountExpiresAt(request.getDiscountExpiresAt());
        if (request.getCurrency() != null) course.setCurrency(request.getCurrency());
        if (request.getCoverImageUrl() != null) course.setCoverImageUrl(request.getCoverImageUrl());
        if (request.getPromoVideoUrl() != null) course.setPromoVideoUrl(request.getPromoVideoUrl());
        if (request.getInstructorName() != null) course.setInstructorName(request.getInstructorName());
        if (request.getInstructorBio() != null) course.setInstructorBio(request.getInstructorBio());
        if (request.getInstructorAvatarUrl() != null) course.setInstructorAvatarUrl(request.getInstructorAvatarUrl());

        if (wasPublished) {
            course.setVersion(course.getVersion() + 1);
        }

        return courseRepository.save(course);
    }

    @Transactional
    public Course publish(UUID courseId, CurrentUser currentUser) {
        Course course = getById(courseId);
        requireCanModify(course, currentUser);

        List<String> errors = validateForPublish(course);
        if (!errors.isEmpty()) {
            throw new CoursePublishValidationException(errors);
        }

        course.setStatus(Course.STATUS_PUBLISHED);
        if (course.getPublishedAt() == null) {
            course.setPublishedAt(Instant.now());
        }
        return courseRepository.save(course);
    }

    private List<String> validateForPublish(Course course) {
        List<String> errors = new ArrayList<>();
        if (course.getCoverImageUrl() == null || course.getCoverImageUrl().isBlank()) {
            errors.add("Cover image is required");
        }
        if (course.getPrice() == null) {
            errors.add("Price must be set (0 for a free course)");
        }

        List<CourseModule> modules = moduleRepository.findByCourseIdOrderByPositionAsc(course.getId());
        if (modules.isEmpty()) {
            errors.add("At least one module is required");
            return errors;
        }

        List<UUID> moduleIds = modules.stream().map(CourseModule::getId).toList();
        long lessonCount = lessonRepository.countByModuleIdIn(moduleIds);
        if (lessonCount == 0) {
            errors.add("At least one lesson is required");
        }
        long missingVideoUrls = lessonRepository.countByModuleIdInAndTypeAndVideoUrlIsNull(moduleIds, Lesson.TYPE_VIDEO);
        if (missingVideoUrls > 0) {
            errors.add(missingVideoUrls + " video lesson(s) are missing a video URL");
        }
        return errors;
    }

    @Transactional
    public Course archive(UUID courseId, CurrentUser currentUser) {
        Course course = getById(courseId);
        requireCanModify(course, currentUser);
        course.setStatus(Course.STATUS_ARCHIVED);
        return courseRepository.save(course);
    }

    @Transactional
    public void delete(UUID courseId, CurrentUser currentUser) {
        Course course = getById(courseId);
        requireCanModify(course, currentUser);
        if (course.getEnrollmentCount() > 0) {
            throw new CourseDeletionBlockedException("Cannot delete a course with active enrollments — archive it instead");
        }
        courseRepository.delete(course);
    }

    public List<CourseVersion> getVersions(UUID courseId, CurrentUser currentUser) {
        Course course = getById(courseId);
        requireCanModify(course, currentUser);
        return versionRepository.findByCourseIdOrderByVersionDesc(courseId);
    }

    @Transactional
    public Course restoreVersion(UUID courseId, UUID versionId, CurrentUser currentUser) {
        Course course = getById(courseId);
        requireCanModify(course, currentUser);
        CourseVersion targetVersion = versionRepository.findById(versionId)
            .filter(v -> v.getCourseId().equals(courseId))
            .orElseThrow(() -> new EntityNotFoundException("Version not found"));

        snapshotVersion(course, currentUser.id(),
            "Pre-restore snapshot (restoring to v" + targetVersion.getVersion() + ")");

        try {
            Course restored = objectMapper.readValue(targetVersion.getSnapshot(), Course.class);
            course.setTitle(restored.getTitle());
            course.setSubtitle(restored.getSubtitle());
            course.setDescription(restored.getDescription());
            course.setLearningObjectives(restored.getLearningObjectives());
            course.setTargetAudience(restored.getTargetAudience());
            course.setPrerequisites(restored.getPrerequisites());
            course.setCategoryId(restored.getCategoryId());
            course.setDifficulty(restored.getDifficulty());
            course.setLanguage(restored.getLanguage());
            course.setEstimatedDuration(restored.getEstimatedDuration());
            course.setPrice(restored.getPrice());
            course.setDiscountPrice(restored.getDiscountPrice());
            course.setDiscountExpiresAt(restored.getDiscountExpiresAt());
            course.setCurrency(restored.getCurrency());
            course.setCoverImageUrl(restored.getCoverImageUrl());
            course.setPromoVideoUrl(restored.getPromoVideoUrl());
            course.setInstructorName(restored.getInstructorName());
            course.setInstructorBio(restored.getInstructorBio());
            course.setInstructorAvatarUrl(restored.getInstructorAvatarUrl());
            course.setVersion(course.getVersion() + 1);
            return courseRepository.save(course);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to restore course version", e);
        }
    }

    private void snapshotVersion(Course course, UUID changedBy, String summary) {
        try {
            CourseVersion cv = new CourseVersion();
            cv.setCourseId(course.getId());
            cv.setVersion(course.getVersion());
            cv.setSnapshot(objectMapper.writeValueAsString(course));
            cv.setChangedBy(changedBy);
            cv.setChangeSummary(summary);
            versionRepository.save(cv);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to snapshot course version", e);
        }
    }

    // -------------------------------------------------------------------
    // Shared helpers
    // -------------------------------------------------------------------

    Course getById(UUID courseId) {
        return courseRepository.findById(courseId).orElseThrow(() -> new EntityNotFoundException("Course not found"));
    }

    private void requireAdminOrModerator(CurrentUser currentUser) {
        if (!currentUser.isAdminOrModerator()) {
            throw new ForbiddenException("Only super admins or moderators can perform this action");
        }
    }

    private void requireCanModify(Course course, CurrentUser currentUser) {
        if (!currentUser.canModify(course.getInstructorId())) {
            throw new ForbiddenException("You do not have permission to modify this course");
        }
    }
}
