import {apiFetch} from '@grammarcetamol/utilities';

export type ClassType = 'GROUP' | 'PRIVATE';
export type AccessMode = 'OPEN' | 'INVITE_ONLY';
export type PaymentModel = 'FREE' | 'ONE_TIME' | 'RECURRING';
export type ClassStatus = 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'ARCHIVED';
export type SessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
export type EnrollmentStatus = 'PENDING_PAYMENT' | 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED' | 'REMOVED' | 'COMPLETED';

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

export interface MyClassRow {
  enrollment: Enrollment;
  class: LiveClass;
  nextSession: LiveSession | null;
}

export interface InvitationPreview {
  status: 'pending' | 'accepted' | 'revoked';
  negotiatedPrice: number | null;
  class: LiveClass;
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

export interface EnrollResult {
  enrollment: Enrollment;
  authorizationUrl?: string;
}

export interface RoomInfo {
  roomId: string;
  domain: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export interface ClassFilters {
  classType?: ClassType | null;
  search?: string;
}

/** Builds the query string for GET /api/classes. `mine` is deliberately NOT exposed here —
 * on the backend it filters by *instructor*, not the calling student, so it's meaningless for
 * this app; a student's own classes come from getMyClasses() below instead. */
export function buildClassQuery(filters: ClassFilters): string {
  const params = new URLSearchParams();
  if (filters.classType) params.set('classType', filters.classType);
  if (filters.search) params.set('search', filters.search);
  return params.toString();
}

export const classesApi = {
  listClasses(filters: ClassFilters = {}) {
    const qs = buildClassQuery(filters);
    return apiFetch<ApiResponse<LiveClass[]>>(`/api/classes${qs ? `?${qs}` : ''}`);
  },

  getClass(id: string) {
    return apiFetch<ApiResponse<LiveClass>>(`/api/classes/${id}`);
  },

  enrollInClass(id: string, email?: string) {
    return apiFetch<ApiResponse<EnrollResult>>(`/api/classes/${id}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  getInvitationPreview(token: string) {
    return apiFetch<ApiResponse<InvitationPreview>>(`/api/invitations/${token}`);
  },

  acceptInvitation(token: string, email?: string) {
    return apiFetch<ApiResponse<EnrollResult>>(`/api/invitations/${token}/accept`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  /** GET /api/classes/enrollments/mine — deliberately not GET /api/classes?mine=true, which
   * filters by instructor. See that route's own backend comment for why it's nested here. */
  getMyClasses() {
    return apiFetch<ApiResponse<MyClassRow[]>>('/api/classes/enrollments/mine');
  },

  cancelEnrollment(id: string) {
    return apiFetch<ApiResponse<Enrollment>>(`/api/classes/enrollments/${id}`, {
      method: 'DELETE',
    });
  },

  listSessions(classId: string) {
    return apiFetch<ApiResponse<LiveSession[]>>(`/api/classes/${classId}/sessions`);
  },

  /** Only succeeds (200) once the session is genuinely LIVE — every other state (too early,
   * not enrolled, session ended, invite not accepted) is a 403 whose message string is the
   * only machine-readable signal the backend currently exposes. See useSessionLiveStatus. */
  getRoom(classId: string, sessionId: string) {
    return apiFetch<ApiResponse<RoomInfo>>(`/api/classes/${classId}/sessions/${sessionId}/room`);
  },

  listMaterials(classId: string) {
    return apiFetch<ApiResponse<ClassMaterial[]>>(`/api/classes/${classId}/materials`);
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
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Pure — a single line summarizing all of a class's recurring schedule templates, e.g.
 * "Mon, Wed 15:00–16:00 (UTC)" or "Mon 09:00–10:00 · Sat 09:00–10:00 (WAT)". A class with no
 * schedules yet (not scheduled) or only one-off manual sessions returns a fallback string. */
export function formatScheduleSummary(schedules: ClassSchedule[]): string {
  if (schedules.length === 0) return 'Schedule to be announced';

  const timezone = schedules[0].timezone;
  const sameTimezone = schedules.every((s) => s.timezone === timezone);
  const byTime = new Map<string, number[]>();
  for (const s of schedules) {
    const key = `${s.startTime}–${s.endTime}`;
    const days = byTime.get(key) ?? [];
    days.push(s.dayOfWeek);
    byTime.set(key, days);
  }

  const parts = Array.from(byTime.entries()).map(([time, days]) => {
    const dayLabels = days
      .slice()
      .sort((a, b) => a - b)
      .map((d) => DAY_LABELS[d])
      .join(', ');
    return `${dayLabels} ${time}`;
  });

  const summary = parts.join(' · ');
  return sameTimezone ? `${summary} (${timezone})` : summary;
}

/** Pure — capacity text for a class card. The backend list endpoint doesn't return a live
 * enrolled-count (see classes.api.ts's own comment on why), so this only ever distinguishes
 * "unlimited" from "limited to N" rather than showing seats remaining. */
export function formatCapacity(capacity: number | null): string {
  if (capacity == null) return 'Unlimited spots';
  return `Limited to ${capacity} student${capacity === 1 ? '' : 's'}`;
}

export function formatClassPrice(cls: Pick<LiveClass, 'paymentModel' | 'defaultPrice' | 'currency' | 'billingInterval'>): string {
  if (cls.paymentModel === 'FREE') return 'Free';
  const amount = cls.defaultPrice != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: cls.currency }).format(cls.defaultPrice)
    : 'Price on request';
  if (cls.paymentModel === 'RECURRING') {
    return `${amount}/${cls.billingInterval ?? 'period'}`;
  }
  return amount;
}

/** Pure — resolves which action a class card's button should offer for the current student,
 * given their existing enrollment (if any) for that class. Mirrors the state machine described
 * in PLAN.md Task 41: Enroll/Buy/Subscribe/Enter Classroom/Payment Pending. */
export type ClassCardAction = 'enroll-free' | 'buy' | 'subscribe' | 'enter-classroom' | 'payment-pending' | 'ended';

export function resolveClassCardAction(cls: LiveClass, enrollment: Enrollment | undefined): ClassCardAction {
  if (enrollment?.status === 'ACTIVE' || enrollment?.status === 'PAUSED') return 'enter-classroom';
  if (enrollment?.status === 'PENDING_PAYMENT') return 'payment-pending';
  if (cls.status === 'ENDED' || cls.status === 'ARCHIVED') return 'ended';
  if (cls.paymentModel === 'FREE') return 'enroll-free';
  if (cls.paymentModel === 'RECURRING') return 'subscribe';
  return 'buy';
}
