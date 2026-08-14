import {ApiError, apiFetch} from '@grammarcetamol/utilities';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  parentId: string | null;
  sortOrder: number;
}

export interface Course {
  id: string;
  slug: string;
  instructorId: string;
  instructorName: string;
  instructorBio: string | null;
  instructorAvatarUrl: string | null;
  title: string;
  subtitle: string | null;
  description: string;
  learningObjectives: string[];
  targetAudience: string | null;
  prerequisites: string | null;
  categoryId: string | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  estimatedDuration: number | null;
  status: 'draft' | 'review' | 'published' | 'archived';
  price: number;
  discountPrice: number | null;
  discountExpiresAt: string | null;
  currency: string;
  coverImageUrl: string | null;
  promoVideoUrl: string | null;
  enrollmentCount: number;
  avgRating: number | null;
  reviewCount: number;
  version: number;
  publishedAt: string | null;
  createdAt: string;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  position: number;
  published: boolean;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  type: 'video' | 'text' | 'quiz' | 'resource';
  duration: number | null;
  position: number;
  videoUrl: string | null;
  uploadFileId: string | null;
  allowDownload: boolean;
  preview: boolean;
  published: boolean;
}

export interface LessonResponse extends Omit<Lesson, 'moduleId'> {}

export interface ModuleResponse {
  id: string;
  title: string;
  description: string | null;
  position: number;
  published: boolean;
  lessons: LessonResponse[];
}

export interface CourseDetailResponse {
  course: Course;
  modules: ModuleResponse[];
}

export interface CourseVersion {
  id: string;
  courseId: string;
  version: number;
  changedBy: string;
  changeSummary: string | null;
  createdAt: string;
}

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export type CourseFormValues = {
  title: string;
  subtitle: string;
  description: string;
  learningObjectives: string[];
  targetAudience: string;
  prerequisites: string;
  categoryId: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  estimatedDuration: string;
  price: string;
  discountPrice: string;
  currency: string;
  coverImageUrl: string;
  promoVideoUrl: string;
  instructorName: string;
  instructorBio: string;
  instructorAvatarUrl: string;
}

/** Publish validation failures arrive as {error, data: string[]} — surface both. */
export class PublishValidationError extends Error {
  constructor(message: string, public readonly errors: string[]) {
    super(message);
  }
}

export const coursesApi = {
  categories() {
    return apiFetch<ApiResponse<Category[]>>('/api/categories');
  },

  detail(id: string) {
    return apiFetch<ApiResponse<CourseDetailResponse>>(`/api/courses/${id}`);
  },

  create(values: CourseFormValues) {
    return apiFetch<ApiResponse<Course>>('/api/courses', {
      method: 'POST',
      body: JSON.stringify(toRequestBody(values)),
    });
  },

  update(id: string, values: CourseFormValues) {
    return apiFetch<ApiResponse<Course>>(`/api/courses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(toRequestBody(values)),
    });
  },

  async publish(id: string) {
    try {
      return await apiFetch<ApiResponse<Course>>(`/api/courses/${id}/publish`, { method: 'POST' });
    } catch (err) {
      const errors = err instanceof ApiError ? (err.body as ApiResponse<string[]> | undefined)?.data : undefined;
      if (Array.isArray(errors)) {
        throw new PublishValidationError(err instanceof ApiError ? err.message : 'Course is not ready to publish', errors);
      }
      throw err;
    }
  },

  archive(id: string) {
    return apiFetch<ApiResponse<Course>>(`/api/courses/${id}/archive`, { method: 'POST' });
  },

  delete(id: string) {
    return apiFetch<void>(`/api/courses/${id}`, { method: 'DELETE' });
  },

  versions(id: string) {
    return apiFetch<ApiResponse<CourseVersion[]>>(`/api/courses/${id}/versions`);
  },

  restoreVersion(id: string, versionId: string) {
    return apiFetch<ApiResponse<Course>>(`/api/courses/${id}/versions/${versionId}/restore`, { method: 'POST' });
  },

  createModule(courseId: string, body: { title: string; description?: string }) {
    return apiFetch<ApiResponse<CourseModule>>(`/api/courses/${courseId}/modules`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateModule(courseId: string, moduleId: string, body: { title?: string; description?: string; published?: boolean }) {
    return apiFetch<ApiResponse<CourseModule>>(`/api/courses/${courseId}/modules/${moduleId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteModule(courseId: string, moduleId: string) {
    return apiFetch<void>(`/api/courses/${courseId}/modules/${moduleId}`, { method: 'DELETE' });
  },

  reorderModules(courseId: string, orderedIds: string[]) {
    return apiFetch<void>(`/api/courses/${courseId}/modules/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ orderedIds }),
    });
  },

  createLesson(courseId: string, moduleId: string, body: Partial<Lesson>) {
    return apiFetch<ApiResponse<Lesson>>(`/api/courses/${courseId}/modules/${moduleId}/lessons`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateLesson(courseId: string, moduleId: string, lessonId: string, body: Partial<Lesson>) {
    return apiFetch<ApiResponse<Lesson>>(`/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteLesson(courseId: string, moduleId: string, lessonId: string) {
    return apiFetch<void>(`/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`, { method: 'DELETE' });
  },

  reorderLessons(courseId: string, moduleId: string, orderedIds: string[]) {
    return apiFetch<void>(`/api/courses/${courseId}/modules/${moduleId}/lessons/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ orderedIds }),
    });
  },
};

export const EMPTY_COURSE_FORM: CourseFormValues = {
  title: '',
  subtitle: '',
  description: '',
  learningObjectives: [],
  targetAudience: '',
  prerequisites: '',
  categoryId: '',
  difficulty: 'beginner',
  language: 'en',
  estimatedDuration: '',
  price: '0',
  discountPrice: '',
  currency: 'USD',
  coverImageUrl: '',
  promoVideoUrl: '',
  instructorName: '',
  instructorBio: '',
  instructorAvatarUrl: '',
};

export function courseToFormValues(course: Course): CourseFormValues {
  return {
    title: course.title,
    subtitle: course.subtitle ?? '',
    description: course.description,
    learningObjectives: course.learningObjectives,
    targetAudience: course.targetAudience ?? '',
    prerequisites: course.prerequisites ?? '',
    categoryId: course.categoryId ?? '',
    difficulty: course.difficulty,
    language: course.language,
    estimatedDuration: course.estimatedDuration != null ? String(course.estimatedDuration) : '',
    price: String(course.price),
    discountPrice: course.discountPrice != null ? String(course.discountPrice) : '',
    currency: course.currency,
    coverImageUrl: course.coverImageUrl ?? '',
    promoVideoUrl: course.promoVideoUrl ?? '',
    instructorName: course.instructorName,
    instructorBio: course.instructorBio ?? '',
    instructorAvatarUrl: course.instructorAvatarUrl ?? '',
  };
}

/** Pure and independently testable — turns form state into the API request body. */
export function toRequestBody(values: CourseFormValues): Record<string, unknown> {
  return {
    title: values.title.trim(),
    subtitle: values.subtitle.trim() || null,
    description: values.description.trim(),
    learningObjectives: values.learningObjectives.filter((o) => o.trim().length > 0),
    targetAudience: values.targetAudience.trim() || null,
    prerequisites: values.prerequisites.trim() || null,
    categoryId: values.categoryId || null,
    difficulty: values.difficulty,
    language: values.language.trim() || 'en',
    estimatedDuration: values.estimatedDuration ? Number(values.estimatedDuration) : null,
    price: values.price ? Number(values.price) : 0,
    discountPrice: values.discountPrice ? Number(values.discountPrice) : null,
    currency: values.currency.trim() || 'USD',
    coverImageUrl: values.coverImageUrl.trim() || null,
    promoVideoUrl: values.promoVideoUrl.trim() || null,
    instructorName: values.instructorName.trim(),
    instructorBio: values.instructorBio.trim() || null,
    instructorAvatarUrl: values.instructorAvatarUrl.trim() || null,
  };
}

/** Pure and independently testable — validates the course form before submit. */
export function validateCourseForm(values: CourseFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.title.trim()) errors.title = 'Title is required';
  if (!values.description.trim()) errors.description = 'Description is required';
  if (!values.instructorName.trim()) errors.instructorName = 'Instructor name is required';
  if (values.price.trim() === '' || Number.isNaN(Number(values.price)) || Number(values.price) < 0) {
    errors.price = 'Enter a valid price (0 for free)';
  }
  if (values.discountPrice.trim() !== '' && (Number.isNaN(Number(values.discountPrice)) || Number(values.discountPrice) < 0)) {
    errors.discountPrice = 'Enter a valid discount price';
  }
  return errors;
}
