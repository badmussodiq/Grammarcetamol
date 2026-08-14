import {apiFetch} from '@grammarcetamol/utilities';

export interface Student {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'STUDENT' | 'MODERATOR' | 'CUSTOMER_SUPPORT';
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  country: string | null;
  timezone: string | null;
  bio: string | null;
  learningGoals: string[] | null;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Raw shape GET /api/users returns — {data, total, page, limit}, not the {items,...} shape
 * every other paged admin endpoint uses. Kept separate rather than normalized, since auth-service
 * is out of scope to reshape here. */
export interface UserListResult {
  data: Student[];
  total: number;
  page: number;
  limit: number;
}

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
  createdAt: string;
  updatedAt: string;
}

export interface CompletionResponse {
  enrolled: boolean;
  completionPct: number;
  enrollmentId: string | null;
}

export interface StudentFilters {
  q: string;
  status: string;
  page: number;
}

export const DEFAULT_STUDENT_FILTERS: StudentFilters = {
  q: '',
  status: '',
  page: 1,
};

/** Pure — turns filter state into the query string /api/users accepts, always scoped to
 * role=STUDENT (the endpoint has no separate "students" route — see PLAN.md Task 29). */
export function buildStudentsQuery(filters: StudentFilters, limit = 20): string {
  const params = new URLSearchParams();
  params.set('role', 'STUDENT');
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  params.set('page', String(filters.page));
  params.set('limit', String(limit));
  return params.toString();
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export const studentsApi = {
  detail(id: string) {
    return apiFetch<ApiResponse<Student>>(`/api/users/${id}`);
  },

  updateStatus(id: string, status: string) {
    return apiFetch<ApiResponse<Student>>(`/api/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  enrollments(userId: string) {
    return apiFetch<ApiResponse<Enrollment[]>>(`/api/enrollments/user/${userId}`);
  },

  completion(userId: string, courseId: string) {
    return apiFetch<ApiResponse<CompletionResponse>>(`/api/enrollments/completion?userId=${userId}&courseId=${courseId}`);
  },
};
