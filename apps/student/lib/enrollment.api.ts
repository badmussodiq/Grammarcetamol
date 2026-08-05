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
  type: 'video' | 'text' | 'quiz' | 'resource';
  duration: number | null;
  position: number;
  videoUrl: string | null;
  /** locked | unlocked | current | completed */
  state: 'locked' | 'unlocked' | 'current' | 'completed';
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
