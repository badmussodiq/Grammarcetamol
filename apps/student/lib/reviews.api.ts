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
  edited: boolean;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

const EDIT_WINDOW_DAYS = 7;

export const reviewsApi = {
  mine(courseId: string) {
    return apiFetch<ApiResponse<Review | null>>(`/api/reviews/mine?courseId=${courseId}`);
  },

  create(body: { courseId: string; rating: number; title?: string; comment?: string }) {
    return apiFetch<ApiResponse<Review>>('/api/reviews', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  update(id: string, body: { rating: number; title?: string; comment?: string }) {
    return apiFetch<ApiResponse<Review>>(`/api/reviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
};

/** Pure — mirrors review-service's own 7-day rule (AppProperties.reviewEditWindowDays) so the
 * frontend can hide the edit action before even trying, rather than only finding out from a
 * 403 after the student has already filled out the form. */
export function isWithinEditWindow(review: Review): boolean {
  const ageMs = Date.now() - new Date(review.createdAt).getTime();
  return ageMs <= EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}
