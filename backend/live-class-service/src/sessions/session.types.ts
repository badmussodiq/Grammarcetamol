import type {ObjectId} from 'mongodb';

export type SessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
export type ReminderTier = '24h' | '1h' | '15min';

/** See PHASE4.md's Domain Model. roomId is deliberately never exposed outside the room-reveal
 * endpoint — see class.types.ts's toPublicClass for the same discipline applied here via
 * toPublicSession below. */
export interface LiveSession {
  classId: ObjectId;
  /** Denormalized from the parent class — Mongo has no cheap join, and the conflict-check
   * query ("does this instructor have another overlapping session") needs to scan by
   * instructor without touching `classes` at all. Written once at session-creation time; a
   * class's instructorId is not expected to change after creation (no endpoint supports it). */
  instructorId: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  status: SessionStatus;
  roomId: string;
  videoDomain: string;
  actualStartedAt: Date | null;
  actualEndedAt: Date | null;
  recordingUrl: string | null;
  createdFrom: 'schedule' | 'manual';
  remindersSent: ReminderTier[];
  createdAt: Date;
  updatedAt: Date;
}

export type LiveSessionDocument = LiveSession & { _id: ObjectId };

export function toPublicSession(doc: LiveSessionDocument): Omit<LiveSession, 'roomId' | 'videoDomain' | 'classId'> & { id: string; classId: string } {
  const { _id, classId, roomId, videoDomain, ...rest } = doc;
  return { id: _id.toHexString(), classId: classId.toHexString(), ...rest };
}
