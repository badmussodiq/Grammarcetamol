import type {ObjectId} from 'mongodb';

export type AnnouncementTargetType = 'all' | 'courses' | 'segments';
export type AnnouncementPriority = 'low' | 'normal' | 'high' | 'critical';
export type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'expired';

export interface Announcement {
  title: string;
  body: string;
  targetType: AnnouncementTargetType;
  /** courseIds when targetType='courses'; ignored/empty for 'all'; 'segments' is a documented
   * no-op — no real user-segment concept exists anywhere in this codebase, so this field is
   * accepted and stored but never resolves to any real recipients for that type. */
  targetIds: string[];
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  publishAt: Date | null;
  expiresAt: Date | null;
  createdBy: string;
  publishedAt: Date | null;
  recipientCount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AnnouncementDocument = Announcement & { _id: ObjectId };

export function toPublicAnnouncement(doc: AnnouncementDocument) {
  const { _id, ...rest } = doc;
  return { id: _id.toHexString(), ...rest };
}
