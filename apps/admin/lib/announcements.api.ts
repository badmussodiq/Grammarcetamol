import {apiFetch} from '@grammarcetamol/utilities';

export type AnnouncementTargetType = 'all' | 'courses' | 'segments';
export type AnnouncementPriority = 'low' | 'normal' | 'high' | 'critical';
export type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'expired';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  targetType: AnnouncementTargetType;
  targetIds: string[];
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  publishAt: string | null;
  expiresAt: string | null;
  createdBy: string;
  publishedAt: string | null;
  recipientCount: number | null;
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

export interface AnnouncementFilters {
  status?: AnnouncementStatus | '';
  page?: number;
}

/** Pure — turns filter state into the query string GET /api/announcements accepts. */
export function buildAnnouncementQuery(filters: AnnouncementFilters, limit = 20): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(limit));
  return `?${params.toString()}`;
}

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** Pure — shared by the list table and the detail page so the two can't drift on what color a
 * given priority renders as. */
export const PRIORITY_BADGE_VARIANT: Record<AnnouncementPriority, BadgeVariant> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  critical: 'error',
};

/** Pure — same reasoning as PRIORITY_BADGE_VARIANT, for status. */
export const STATUS_BADGE_VARIANT: Record<AnnouncementStatus, BadgeVariant> = {
  draft: 'neutral',
  scheduled: 'info',
  published: 'success',
  expired: 'neutral',
};

const TARGET_LABELS: Record<AnnouncementTargetType, string> = {
  all: 'All Students',
  courses: 'Specific Courses',
  segments: 'Specific Segments',
};

/** Pure — the list table's target-audience column, e.g. "Specific Courses (3)". Doesn't resolve
 * course titles here — that would mean an extra fetch per row just for a summary string; the
 * create/edit form is where the actual selected courses are shown by name. */
export function formatTargetAudience(announcement: Pick<Announcement, 'targetType' | 'targetIds'>): string {
  if (announcement.targetType === 'all') return TARGET_LABELS.all;
  const count = announcement.targetIds.length;
  return `${TARGET_LABELS[announcement.targetType]} (${count})`;
}

export type AnnouncementFormValues = {
  title: string;
  body: string;
  targetType: AnnouncementTargetType;
  targetIds: string[];
  priority: AnnouncementPriority;
  schedule: 'now' | 'later' | 'draft';
  publishAt: string;
  expiresAt: string;
};

export const EMPTY_ANNOUNCEMENT_FORM: AnnouncementFormValues = {
  title: '',
  body: '',
  targetType: 'all',
  targetIds: [],
  priority: 'normal',
  schedule: 'draft',
  publishAt: '',
  expiresAt: '',
};

export function announcementToFormValues(a: Announcement): AnnouncementFormValues {
  return {
    title: a.title,
    body: a.body,
    targetType: a.targetType,
    targetIds: a.targetIds,
    priority: a.priority,
    schedule: a.publishAt ? 'later' : 'draft',
    publishAt: a.publishAt ? a.publishAt.slice(0, 16) : '',
    expiresAt: a.expiresAt ? a.expiresAt.slice(0, 16) : '',
  };
}

/** Pure — mirrors AnnouncementsService.update()'s own guard: only a draft's targeting/content
 * can still be edited. Scheduled/published/expired announcements are read-only past this point,
 * since a published announcement's targeting can't retroactively change who already got it. */
export function canEditAnnouncement(status: AnnouncementStatus): boolean {
  return status === 'draft';
}

/** Pure and independently testable — validates the announcement form before submit. */
export function validateAnnouncementForm(values: AnnouncementFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.title.trim()) errors.title = 'Title is required';
  if (!values.body.trim()) errors.body = 'Body is required';
  if (values.targetType === 'courses' && values.targetIds.length === 0) {
    errors.targetIds = 'Select at least one course';
  }
  if (values.schedule === 'later' && !values.publishAt) {
    errors.publishAt = 'Pick a date and time to schedule for';
  }
  return errors;
}

/** Pure and independently testable — turns form state into the create/update request body.
 * `schedule` is a form-only concept (Publish Now / Schedule for later / Save as Draft) — the
 * backend only knows `publishAt`; "now" is expressed by omitting it and letting a caller decide
 * whether to immediately call publish() (see CreateAnnouncementPage). */
export function toAnnouncementRequestBody(values: AnnouncementFormValues): Record<string, unknown> {
  return {
    title: values.title.trim(),
    body: values.body.trim(),
    targetType: values.targetType,
    targetIds: values.targetType === 'courses' ? values.targetIds : undefined,
    priority: values.priority,
    publishAt: values.schedule === 'later' && values.publishAt ? new Date(values.publishAt).toISOString() : undefined,
    expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : undefined,
  };
}

export const announcementsApi = {
  list(filters: AnnouncementFilters = {}) {
    return apiFetch<ApiResponse<Paged<Announcement>>>(`/api/announcements${buildAnnouncementQuery(filters)}`);
  },

  get(id: string) {
    return apiFetch<ApiResponse<Announcement>>(`/api/announcements/${id}`);
  },

  create(values: AnnouncementFormValues) {
    return apiFetch<ApiResponse<Announcement>>('/api/announcements', {
      method: 'POST',
      body: JSON.stringify(toAnnouncementRequestBody(values)),
    });
  },

  update(id: string, values: AnnouncementFormValues) {
    return apiFetch<ApiResponse<Announcement>>(`/api/announcements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(toAnnouncementRequestBody(values)),
    });
  },

  remove(id: string) {
    return apiFetch<ApiResponse<null>>(`/api/announcements/${id}`, { method: 'DELETE' });
  },

  publish(id: string) {
    return apiFetch<ApiResponse<Announcement>>(`/api/announcements/${id}/publish`, { method: 'POST' });
  },

  sendTest(id: string) {
    return apiFetch<ApiResponse<null>>(`/api/announcements/${id}/send-test`, { method: 'POST' });
  },

  recipientCount(id: string) {
    return apiFetch<ApiResponse<{ count: number }>>(`/api/announcements/${id}/recipient-count`);
  },
};
