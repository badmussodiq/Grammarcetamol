import type {ObjectId} from 'mongodb';

export type ClassType = 'GROUP' | 'PRIVATE';
export type AccessMode = 'OPEN' | 'INVITE_ONLY';
export type PaymentModel = 'FREE' | 'ONE_TIME' | 'RECURRING';
export type ClassStatus = 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'ARCHIVED';

export interface ClassSchedule {
  dayOfWeek: number; // 0 (Sunday) - 6 (Saturday)
  startTime: string; // "HH:mm", interpreted in `timezone`
  endTime: string;
  timezone: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
}

/** See PHASE4.md's Domain Model — the canonical field reference this mirrors exactly. */
export interface LiveClass {
  title: string;
  description: string;
  coverImageUrl: string | null;
  classType: ClassType;
  accessMode: AccessMode;
  instructorId: string;
  paymentModel: PaymentModel;
  defaultPrice: number | null;
  currency: string;
  billingInterval: string | null; // required when paymentModel === 'RECURRING'
  capacity: number | null; // null = unlimited
  status: ClassStatus;
  chatLocked: boolean;
  materialsRetentionDays: number;
  videoProvider: string;
  schedules: ClassSchedule[];
  createdBy: string;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type LiveClassDocument = LiveClass & { _id: ObjectId };

/** Never includes roomId (that lives on live_sessions, not classes) — nothing to redact here,
 * but kept as an explicit projection type so a future field addition doesn't silently leak
 * through a list/detail response without a conscious decision. */
export function toPublicClass(doc: LiveClassDocument): LiveClass & { id: string } {
  const { _id, ...rest } = doc;
  return { id: _id.toHexString(), ...rest };
}
