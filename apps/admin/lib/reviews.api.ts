import { apiFetch } from '@grammarcetamol/utilities';

export interface Review {
  id: string;
  userId: string;
  courseId: string;
  enrollmentId: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  moderatedBy: string | null;
  moderatedAt: string | null;
  moderationNote: string | null;
  edited: boolean;
  editedAt: string | null;
  helpfulCount: number;
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

export interface ReviewFilters {
  status: string;
  courseId: string;
  rating: string;
  page: number;
}

export const DEFAULT_REVIEW_FILTERS: ReviewFilters = {
  status: '',
  courseId: '',
  rating: '',
  page: 1,
};

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

/** Pure — turns filter state into the query string /api/reviews accepts. Mirrors
 * transactions.api.ts's buildTransactionsQuery pattern. */
export function buildReviewsQuery(filters: ReviewFilters, limit = 20): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.courseId) params.set('courseId', filters.courseId);
  if (filters.rating) params.set('rating', filters.rating);
  params.set('page', String(filters.page));
  params.set('limit', String(limit));
  return params.toString();
}

export const reviewsApi = {
  detail(id: string) {
    return apiFetch<ApiResponse<Review>>(`/api/reviews/${id}`);
  },

  moderate(id: string, body: { status: string; note?: string }) {
    return apiFetch<ApiResponse<Review>>(`/api/reviews/${id}/moderate`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
};
