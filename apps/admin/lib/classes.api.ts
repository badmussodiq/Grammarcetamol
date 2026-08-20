import {apiFetch} from '@grammarcetamol/utilities';

export type ClassType = 'GROUP' | 'PRIVATE';
export type AccessMode = 'OPEN' | 'INVITE_ONLY';
export type PaymentModel = 'FREE' | 'ONE_TIME' | 'RECURRING';
export type ClassStatus = 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'ARCHIVED';
export type SessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
export type EnrollmentStatus = 'PENDING_PAYMENT' | 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED' | 'REMOVED' | 'COMPLETED';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked';

// This is a separate, admin-facing client over overlapping-but-not-identical endpoints, not a
// shared one with the student app — it needs internal fields (schedules[] templates, conflict
// data) the student-facing client deliberately omits, and its own admin-only endpoints
// (enrollments/invitations listing, session reschedule) the student side has no use for.

export interface ClassSchedule {
  dayOfWeek: number; // 0 (Sunday) - 6 (Saturday)
  startTime: string; // "HH:mm"
  endTime: string;
  timezone: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

export interface LiveClass {
  id: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  classType: ClassType;
  accessMode: AccessMode;
  instructorId: string;
  paymentModel: PaymentModel;
  defaultPrice: number | null;
  currency: string;
  billingInterval: string | null;
  capacity: number | null;
  status: ClassStatus;
  chatLocked: boolean;
  materialsRetentionDays: number;
  videoProvider: string;
  schedules: ClassSchedule[];
  createdBy: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LiveSession {
  id: string;
  classId: string;
  instructorId: string;
  startTime: string;
  endTime: string;
  timezone: string;
  status: SessionStatus;
  actualStartedAt: string | null;
  actualEndedAt: string | null;
  recordingUrl: string | null;
  createdFrom: 'schedule' | 'manual';
  remindersSent: string[];
}

export interface Enrollment {
  id: string;
  classId: string;
  studentId: string;
  status: EnrollmentStatus;
  negotiatedPrice: number | null;
  subscriptionId: string | null;
  paymentId: string | null;
  accessUntil: string;
  invitationId: string | null;
  enrolledAt: string;
  endedAt: string | null;
  endedReason: string | null;
}

export interface EnrollmentRow {
  enrollment: Enrollment;
  student: { id: string; email: string; fullName: string | null };
}

export interface Invitation {
  id: string;
  classId: string;
  studentId: string;
  token: string;
  negotiatedPrice: number | null;
  status: InvitationStatus;
  invitedBy: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface ClassMaterial {
  id: string;
  classId: string;
  sessionId: string | null;
  title: string;
  fileUrl: string;
  uploadedBy: string;
  visibleFrom: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  classId: string;
  senderId: string;
  senderRole: 'instructor' | 'student' | 'admin';
  body: string;
  createdAt: string;
}

export interface ConflictDetail {
  sessionId: string;
  startTime: string;
  endTime: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export interface ClassFilters {
  classType?: ClassType | '';
  accessMode?: AccessMode | '';
  instructorId?: string;
  search?: string;
}

/** Pure — colocated so it's testable without mocking fetch. */
export function buildClassQuery(filters: ClassFilters): string {
  const params = new URLSearchParams();
  if (filters.classType) params.set('classType', filters.classType);
  if (filters.accessMode) params.set('accessMode', filters.accessMode);
  if (filters.instructorId) params.set('instructorId', filters.instructorId);
  if (filters.search) params.set('search', filters.search);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Pure — a lightweight day-of-week + time-of-day overlap check between a class's proposed
 * recurring schedule rows and an instructor's existing busy periods (from
 * `instructorAvailability`). This is a real-time UI hint, not the source of truth — the
 * backend runs the real occurrence-by-occurrence check against actual dates when the schedule
 * is actually saved (`SessionsService.generateFromSchedules`); this only needs to warn the
 * admin before they get there, so a same-day/overlapping-time match is close enough. Compares
 * in UTC only — good enough for a warning, not for the authoritative reschedule bookkeeping. */
export function findScheduleConflicts(schedules: ClassSchedule[], busyPeriods: ConflictDetail[]): ClassSchedule[] {
  return schedules.filter((schedule) =>
    busyPeriods.some((busy) => {
      const busyStart = new Date(busy.startTime);
      const busyEnd = new Date(busy.endTime);
      if (busyStart.getUTCDay() !== schedule.dayOfWeek) return false;

      const busyStartMinutes = busyStart.getUTCHours() * 60 + busyStart.getUTCMinutes();
      const busyEndMinutes = busyEnd.getUTCHours() * 60 + busyEnd.getUTCMinutes();
      const [schedStartH, schedStartM] = schedule.startTime.split(':').map(Number);
      const [schedEndH, schedEndM] = schedule.endTime.split(':').map(Number);
      const schedStartMinutes = schedStartH * 60 + schedStartM;
      const schedEndMinutes = schedEndH * 60 + schedEndM;

      return schedStartMinutes < busyEndMinutes && schedEndMinutes > busyStartMinutes;
    }),
  );
}

const DAY_ABBREV = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Pure — the classes-list table's schedule-summary column, e.g. "Mon, Wed 15:00–16:00". A
 * class with no recurring schedule yet (only one-off manual sessions, or none at all) returns
 * a fallback string. */
export function formatClassSchedule(schedules: ClassSchedule[]): string {
  if (schedules.length === 0) return 'No recurring schedule';
  const byTime = new Map<string, number[]>();
  for (const s of schedules) {
    const key = `${s.startTime}–${s.endTime}`;
    const days = byTime.get(key) ?? [];
    days.push(s.dayOfWeek);
    byTime.set(key, days);
  }
  return Array.from(byTime.entries())
    .map(([time, days]) => `${days.slice().sort((a, b) => a - b).map((d) => DAY_ABBREV[d]).join(', ')} ${time}`)
    .join(' · ');
}

/** Pure — the classes-list table's price column. */
export function formatClassPrice(cls: Pick<LiveClass, 'paymentModel' | 'defaultPrice' | 'currency' | 'billingInterval'>): string {
  if (cls.paymentModel === 'FREE') return 'Free';
  const amount = cls.defaultPrice != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: cls.currency }).format(cls.defaultPrice)
    : 'Price on request';
  return cls.paymentModel === 'RECURRING' ? `${amount}/${cls.billingInterval ?? 'period'}` : amount;
}

export type ClassFormValues = {
  title: string;
  description: string;
  classType: ClassType;
  accessMode: AccessMode;
  instructorId: string;
  paymentModel: PaymentModel;
  defaultPrice: string;
  currency: string;
  billingInterval: string;
  capacity: string;
  materialsRetentionDays: string;
  videoProvider: string;
  coverImageUrl: string;
  schedules: ClassSchedule[];
};

export const EMPTY_CLASS_FORM: ClassFormValues = {
  title: '',
  description: '',
  classType: 'GROUP',
  accessMode: 'OPEN',
  instructorId: '',
  paymentModel: 'FREE',
  defaultPrice: '',
  currency: 'NGN',
  billingInterval: 'monthly',
  capacity: '',
  materialsRetentionDays: '14',
  videoProvider: 'jitsi',
  coverImageUrl: '',
  schedules: [],
};

export function classToFormValues(cls: LiveClass): ClassFormValues {
  return {
    title: cls.title,
    description: cls.description,
    classType: cls.classType,
    accessMode: cls.accessMode,
    instructorId: cls.instructorId,
    paymentModel: cls.paymentModel,
    defaultPrice: cls.defaultPrice != null ? String(cls.defaultPrice) : '',
    currency: cls.currency,
    billingInterval: cls.billingInterval ?? 'monthly',
    capacity: cls.capacity != null ? String(cls.capacity) : '',
    materialsRetentionDays: String(cls.materialsRetentionDays),
    videoProvider: cls.videoProvider,
    coverImageUrl: cls.coverImageUrl ?? '',
    schedules: cls.schedules,
  };
}

/** Pure and independently testable — turns form state into the create/update request body. */
export function toClassRequestBody(values: ClassFormValues): Record<string, unknown> {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    classType: values.classType,
    accessMode: values.accessMode,
    paymentModel: values.paymentModel,
    defaultPrice: values.paymentModel === 'FREE' ? null : (values.defaultPrice ? Number(values.defaultPrice) : null),
    currency: values.currency.trim() || 'NGN',
    billingInterval: values.paymentModel === 'RECURRING' ? values.billingInterval : null,
    capacity: values.classType === 'GROUP' && values.capacity ? Number(values.capacity) : null,
    materialsRetentionDays: values.materialsRetentionDays ? Number(values.materialsRetentionDays) : 14,
    videoProvider: values.videoProvider,
    coverImageUrl: values.coverImageUrl.trim() || null,
    schedules: values.schedules,
  };
}

/** Pure and independently testable — validates the class form before submit. */
export function validateClassForm(values: ClassFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.title.trim()) errors.title = 'Title is required';
  if (!values.description.trim()) errors.description = 'Description is required';
  if (!values.instructorId) errors.instructorId = 'Select an instructor';
  if (values.paymentModel !== 'FREE') {
    if (!values.defaultPrice || Number.isNaN(Number(values.defaultPrice)) || Number(values.defaultPrice) <= 0) {
      errors.defaultPrice = 'Enter a price greater than 0';
    }
  }
  if (values.paymentModel === 'RECURRING' && !values.billingInterval) {
    errors.billingInterval = 'Select a billing interval';
  }
  if (values.classType === 'GROUP' && values.capacity && (Number.isNaN(Number(values.capacity)) || Number(values.capacity) <= 0)) {
    errors.capacity = 'Enter a valid capacity, or leave blank for unlimited';
  }
  return errors;
}

export const classesApi = {
  list(filters: ClassFilters = {}) {
    const qs = buildClassQuery(filters);
    return apiFetch<ApiResponse<LiveClass[]>>(`/api/classes${qs}`);
  },

  get(id: string) {
    return apiFetch<ApiResponse<LiveClass>>(`/api/classes/${id}`);
  },

  create(values: ClassFormValues) {
    return apiFetch<ApiResponse<LiveClass>>('/api/classes', {
      method: 'POST',
      body: JSON.stringify({ ...toClassRequestBody(values), instructorId: values.instructorId }),
    });
  },

  update(id: string, values: ClassFormValues) {
    return apiFetch<ApiResponse<LiveClass>>(`/api/classes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(toClassRequestBody(values)),
    });
  },

  publish(id: string) {
    return apiFetch<ApiResponse<LiveClass>>(`/api/classes/${id}/publish`, { method: 'POST' });
  },

  end(id: string) {
    return apiFetch<ApiResponse<LiveClass>>(`/api/classes/${id}/end`, { method: 'POST' });
  },

  setChatLock(id: string, locked: boolean) {
    return apiFetch<ApiResponse<LiveClass>>(`/api/classes/${id}/chat-lock`, {
      method: 'PATCH',
      body: JSON.stringify({ locked }),
    });
  },

  listSessions(classId: string) {
    return apiFetch<ApiResponse<LiveSession[]>>(`/api/classes/${classId}/sessions`);
  },

  createSession(classId: string, body: { startTime: string; endTime: string; timezone: string }) {
    return apiFetch<ApiResponse<LiveSession>>(`/api/classes/${classId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** Also the "cancel" action for a SCHEDULED session — see SessionsService.end()'s own
   * comment: there's no separate CANCELLED-status endpoint, "end" a SCHEDULED session is a
   * cancel in every way that matters. */
  endSession(sessionId: string) {
    return apiFetch<ApiResponse<null>>(`/api/sessions/${sessionId}/end`, { method: 'POST' });
  },

  startSession(sessionId: string) {
    return apiFetch<ApiResponse<null>>(`/api/sessions/${sessionId}/start`, { method: 'POST' });
  },

  rescheduleSession(sessionId: string, startTime: string, endTime: string) {
    return apiFetch<ApiResponse<LiveSession>>(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ startTime, endTime }),
    });
  },

  instructorAvailability(instructorId: string, from: string, to: string, excludeClassId?: string) {
    const excludeParam = excludeClassId ? `&excludeClassId=${encodeURIComponent(excludeClassId)}` : '';
    return apiFetch<ApiResponse<ConflictDetail[]>>(
      `/api/instructors/${instructorId}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${excludeParam}`,
    );
  },

  listMaterials(classId: string) {
    return apiFetch<ApiResponse<ClassMaterial[]>>(`/api/classes/${classId}/materials`);
  },

  createMaterial(classId: string, body: { title: string; fileUrl: string; sessionId?: string; visibleFrom?: string }) {
    return apiFetch<ApiResponse<ClassMaterial>>(`/api/classes/${classId}/materials`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  listMessages(classId: string) {
    return apiFetch<ApiResponse<ChatMessage[]>>(`/api/classes/${classId}/messages`);
  },

  postMessage(classId: string, body: string) {
    return apiFetch<ApiResponse<ChatMessage>>(`/api/classes/${classId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

  listEnrollments(classId: string) {
    return apiFetch<ApiResponse<EnrollmentRow[]>>(`/api/classes/${classId}/enrollments`);
  },

  removeEnrollment(enrollmentId: string) {
    return apiFetch<ApiResponse<Enrollment>>(`/api/classes/enrollments/${enrollmentId}`, { method: 'DELETE' });
  },

  listInvitations(classId: string) {
    return apiFetch<ApiResponse<Invitation[]>>(`/api/classes/${classId}/invitations`);
  },

  invite(classId: string, studentId: string, negotiatedPrice?: number) {
    return apiFetch<ApiResponse<Invitation>>(`/api/classes/${classId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ studentId, negotiatedPrice }),
    });
  },
};

export interface InstructorOption {
  id: string;
  email: string;
  fullName: string | null;
}

/** No dedicated "instructor" entity exists anywhere in this platform (see CurrentUser's own
 * doc comment in live-class-service) — any SUPER_ADMIN/MODERATOR can be a class's instructor,
 * it's an audit-trail field, not a foreign key. `GET /api/users` only accepts one `role` value
 * at a time, so this fans out to both and merges — small, fixed-size result set, not worth a
 * new backend endpoint just to avoid two calls. */
export const instructorsApi = {
  async list(): Promise<InstructorOption[]> {
    const [admins, moderators] = await Promise.all([
      apiFetch<ApiResponse<{ data: InstructorOption[] }>>('/api/users?role=SUPER_ADMIN&limit=100'),
      apiFetch<ApiResponse<{ data: InstructorOption[] }>>('/api/users?role=MODERATOR&limit=100'),
    ]);
    return [...admins.data.data, ...moderators.data.data];
  },
};
