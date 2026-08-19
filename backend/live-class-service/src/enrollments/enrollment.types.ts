import type {ObjectId} from 'mongodb';

export type EnrollmentStatus = 'PENDING_PAYMENT' | 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED' | 'REMOVED' | 'COMPLETED';

/** See PHASE4.md's Domain Model — accessUntil is the field that makes the access-vs-billing
 * split work; every access check reads this, never subscription status directly. */
export interface Enrollment {
  classId: ObjectId;
  studentId: string;
  status: EnrollmentStatus;
  negotiatedPrice: number | null;
  subscriptionId: string | null; // payment-service subscriptions.id, opaque here
  paymentId: string | null; // payment-service payments.id, opaque here
  /** Set to a positive-infinity-like far-future date for FREE/ONE_TIME enrollments (never
   * naturally expires); set to the subscription's currentPeriodEnd for RECURRING ones. */
  accessUntil: Date;
  /** Only set (non-null) for enrollments that originated from an accepted invitation — the
   * fourth room-authorization condition for INVITE_ONLY classes reads this. */
  invitationId: ObjectId | null;
  enrolledAt: Date;
  endedAt: Date | null;
  endedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type EnrollmentDocument = Enrollment & { _id: ObjectId };

export function toPublicEnrollment(doc: EnrollmentDocument): Omit<Enrollment, 'classId'> & { id: string; classId: string } {
  const { _id, classId, ...rest } = doc;
  return { id: _id.toHexString(), classId: classId.toHexString(), ...rest };
}

export interface Invitation {
  classId: ObjectId;
  studentId: string;
  token: string;
  negotiatedPrice: number | null;
  status: 'pending' | 'accepted' | 'revoked';
  invitedBy: string;
  acceptedAt: Date | null;
  createdAt: Date;
}

export type InvitationDocument = Invitation & { _id: ObjectId };
