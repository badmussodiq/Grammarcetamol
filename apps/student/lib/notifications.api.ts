import {apiFetch} from '@grammarcetamol/utilities';

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

/** Pure — where clicking a notification should navigate, if anywhere. Shared by the bell
 * dropdown and the /notifications page so the two never drift on what a given type means to
 * click. `null` means "no deep-link target" (e.g. announcements/system just stay where they
 * are, course notifications have no single obvious destination). */
export function resolveNotificationRoute(notification: Pick<Notification, 'type' | 'relatedId'>): string | null {
  if (!notification.relatedId) return null;
  if (notification.type === 'live_class') return `/live-classes/${notification.relatedId}`;
  if (notification.type === 'payment') return `/transactions/${notification.relatedId}`;
  return null;
}

export type PreferenceType = Exclude<NotificationType, 'system'>;

export interface ChannelPreference {
  inApp: boolean;
  email: boolean;
}

export type Preferences = Record<PreferenceType, ChannelPreference>;

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

  getPreferences() {
    return apiFetch<ApiResponse<Preferences>>('/api/notification-preferences');
  },

  /** Partial — only the types being changed need to be present; the backend merges over the
   * caller's existing preferences (see PreferencesService), same reason the update form below
   * only ever sends the one type/channel the user actually toggled. */
  updatePreferences(patch: Partial<Preferences>) {
    return apiFetch<ApiResponse<Preferences>>('/api/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9000';
const MAX_CONSECUTIVE_STREAM_ERRORS = 3;

/**
 * Wraps the browser's EventSource around Task 40's SSE endpoint. EventSource already retries
 * automatically on a dropped connection (the browser's own built-in behavior) — this only
 * intervenes once several consecutive reconnect attempts have failed, calling
 * `onFallbackToPolling` so the caller can switch to polling `unreadCount()`/`list()` instead of
 * leaving the UI silently stale forever. Returns an unsubscribe function for a `useEffect`
 * cleanup; safe to call more than once.
 */
export function subscribeToStream(
  onMessage: (notification: Notification) => void,
  onFallbackToPolling: () => void,
): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  let closed = false;
  let consecutiveErrors = 0;
  const source = new EventSource(`${API_URL}/api/notifications/stream`, { withCredentials: true });

  source.onopen = () => {
    consecutiveErrors = 0;
  };

  source.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data) as Notification);
    } catch {
      // A malformed frame shouldn't kill the whole stream — just skip it.
    }
  };

  source.onerror = () => {
    consecutiveErrors += 1;
    if (consecutiveErrors >= MAX_CONSECUTIVE_STREAM_ERRORS && !closed) {
      closed = true;
      source.close();
      onFallbackToPolling();
    }
  };

  return () => {
    closed = true;
    source.close();
  };
}

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
