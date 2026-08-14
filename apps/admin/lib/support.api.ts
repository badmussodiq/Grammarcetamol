import {apiFetch} from '@grammarcetamol/utilities';

export interface SupportTicket {
  _id: string;
  name: string;
  email: string;
  userId: string | null;
  subject: string;
  message: string;
  courseId: string | null;
  status: 'open' | 'closed';
  closedBy: string | null;
  closedAt: string | null;
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

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

/** Pure — turns filter state into the query string /api/support/tickets accepts. */
export function buildSupportQuery(status: string, page: number, limit = 20): string {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  return params.toString();
}

export const supportApi = {
  list(status: string, page = 1, limit = 20) {
    return apiFetch<ApiResponse<Paged<SupportTicket>>>(`/api/support/tickets?${buildSupportQuery(status, page, limit)}`);
  },

  detail(id: string) {
    return apiFetch<ApiResponse<SupportTicket>>(`/api/support/tickets/${id}`);
  },

  close(id: string) {
    return apiFetch<ApiResponse<SupportTicket>>(`/api/support/tickets/${id}/close`, { method: 'PATCH' });
  },
};
