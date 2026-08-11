import { apiFetch } from '@grammarcetamol/utilities';

export type NotificationType = 'course' | 'payment' | 'live_class' | 'announcement' | 'system';

export interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId: string | null;
  readAt: string | null;
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

export interface NotificationListFilters {
  type?: NotificationType;
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

export const notificationsApi = {
  list(filters: NotificationListFilters = {}) {
    return apiFetch<ApiResponse<Paged<Notification>>>(`/api/notifications${buildNotificationsQuery(filters)}`);
  },

  unreadCount() {
    return apiFetch<ApiResponse<{ count: number }>>('/api/notifications/unread-count');
  },

  markRead(id: string) {
    return apiFetch<ApiResponse<null>>(`/api/notifications/${id}/read`, { method: 'PATCH' });
  },

  markAllRead() {
    return apiFetch<ApiResponse<null>>('/api/notifications/read-all', { method: 'PATCH' });
  },

  remove(id: string) {
    return apiFetch<ApiResponse<null>>(`/api/notifications/${id}`, { method: 'DELETE' });
  },
};

/** Pure — colocated so it's testable without mocking fetch. */
export function buildNotificationsQuery(filters: NotificationListFilters): string {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.unreadOnly) params.set('unreadOnly', 'true');
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
