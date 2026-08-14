import type {ObjectId} from 'mongodb';

export type NotificationType = 'course' | 'payment' | 'live_class' | 'announcement' | 'system';

/** Per-user in-app inbox row — distinct from notification_logs (an append-only send-audit
 * trail, admin-only). This collection is the student-facing "what happened to me" feed:
 * mutable (readAt gets set), scoped to one userId, and never exposed to any other user. */
export interface Notification {
  _id?: ObjectId;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId: string | null;
  readAt: Date | null;
  createdAt: Date;
}
