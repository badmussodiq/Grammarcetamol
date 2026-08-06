import { apiFetch } from '@grammarcetamol/utilities';

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  status: 'active' | 'completed' | 'dropped' | 'expired';
  pricePaid: number;
  currency: string;
  paymentId: string | null;
  enrolledAt: string;
  completedAt: string | null;
  expiresAt: string | null;
}

export interface LearnLesson {
  id: string;
  title: string;
  description: string | null;
  type: 'video' | 'text' | 'quiz' | 'resource';
  duration: number | null;
  position: number;
  /** For a 'video' lesson, the video URL. For 'text'/'resource' lessons with an attached upload,
   * the attached file's URL (an image or a PDF) — never proxied, always a signed object-storage
   * URL once resolved via upload-service. */
  videoUrl: string | null;
  /** Whether the student gets an actual download/open-in-new-tab link for the attached file.
   * False by default — content still renders inline (video/img/iframe) either way; this only
   * controls the explicit "take a copy" affordance, which the instructor opts into per lesson. */
  allowDownload: boolean;
  /** unlocked | current | completed — no "locked" state. Once a student is enrolled in a
   * course, every lesson in it is freely accessible in any order; only completion is tracked. */
  state: 'unlocked' | 'current' | 'completed';
  watchPosition: number;
}

export interface LearnModule {
  id: string;
  title: string;
  position: number;
  lessons: LearnLesson[];
}

export interface LearnResponse {
  courseId: string;
  courseTitle: string;
  completionPct: number;
  modules: LearnModule[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export const enrollmentApi = {
  enrollFree(courseId: string) {
    return apiFetch<ApiResponse<Enrollment>>('/api/enrollments', {
      method: 'POST',
      body: JSON.stringify({ courseId }),
    });
  },

  getMyEnrollments() {
    return apiFetch<ApiResponse<Enrollment[]>>('/api/enrollments/mine');
  },

  getLearnState(courseId: string) {
    return apiFetch<ApiResponse<LearnResponse>>(`/api/enrollments/course/${courseId}/learn`);
  },

  updateProgress(courseId: string, lessonId: string, currentTime: number, completed: boolean) {
    return apiFetch<ApiResponse<unknown>>('/api/progress', {
      method: 'PATCH',
      body: JSON.stringify({ courseId, lessonId, currentTime, completed }),
    });
  },
};

/** Pure — finds the lesson to open by default: the first "current" (already in progress) lesson,
 * else the first "unlocked" one, else just the first lesson in the course. */
export function findDefaultLesson(modules: LearnModule[]): LearnLesson | null {
  const allLessons = modules.flatMap((m) => m.lessons);
  return (
    allLessons.find((l) => l.state === 'current') ??
    allLessons.find((l) => l.state === 'unlocked') ??
    allLessons[0] ??
    null
  );
}

/** Pure — used by the checkout success screen to poll until the enrollment created from a
 * payment.completed event (async, published by payment-service, consumed by enrollment-service)
 * actually shows up. */
export function hasEnrollmentFor(enrollments: Enrollment[], courseId: string): boolean {
  return enrollments.some((e) => e.courseId === courseId);
}
