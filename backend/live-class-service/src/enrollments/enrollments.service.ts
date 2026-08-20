import {BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, OnApplicationBootstrap} from '@nestjs/common';
import {Cron, CronExpression} from '@nestjs/schedule';
import {randomBytes} from 'crypto';
import type {Collection, Db} from 'mongodb';
import {ObjectId} from 'mongodb';
import {MONGO_DB} from '@/config/database.module';
import {AuthServiceClient} from '@/clients/auth-service.client';
import {PaymentServiceClient} from '@/clients/payment-service.client';
import {LiveClassEventPublisher} from '@/messaging/live-class-event-publisher';
import type {LiveClass, LiveClassDocument} from '@/classes/class.types';
import {toPublicClass} from '@/classes/class.types';
import type {LiveSession, LiveSessionDocument} from '@/sessions/session.types';
import {toPublicSession} from '@/sessions/session.types';
import type {Enrollment, EnrollmentDocument, Invitation, InvitationDocument} from './enrollment.types';
import {toPublicEnrollment, toPublicInvitation} from './enrollment.types';

// A FREE/ONE_TIME enrollment never naturally expires — modeled as a date far enough out that
// nothing in this codebase's lifetime will reach it, rather than a nullable accessUntil, so
// every access check can stay a single unconditional date comparison with no null-branching.
const NEVER_EXPIRES = new Date('2100-01-01T00:00:00.000Z');

export interface EnrollResult {
  enrollment: ReturnType<typeof toPublicEnrollment>;
  authorizationUrl?: string;
}

@Injectable()
export class EnrollmentsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EnrollmentsService.name);

  constructor(
    @Inject(MONGO_DB) private readonly db: Db,
    private readonly paymentServiceClient: PaymentServiceClient,
    private readonly authServiceClient: AuthServiceClient,
    private readonly eventPublisher: LiveClassEventPublisher,
  ) {}

  private enrollments(): Collection<Enrollment> {
    return this.db.collection<Enrollment>('enrollments');
  }

  private invitations(): Collection<Invitation> {
    return this.db.collection<Invitation>('invitations');
  }

  private classes(): Collection<LiveClass> {
    return this.db.collection<LiveClass>('classes');
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.enrollments().createIndex({ classId: 1, studentId: 1 }, { unique: true });
    await this.enrollments().createIndex({ studentId: 1 });
    await this.enrollments().createIndex({ status: 1, accessUntil: 1 });
    await this.invitations().createIndex({ token: 1 }, { unique: true });
  }

  private async findClass(classId: string): Promise<LiveClass & { _id: ObjectId }> {
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(classId);
    } catch {
      throw new NotFoundException(`Class not found: ${classId}`);
    }
    const doc = await this.classes().findOne({ _id: objectId });
    if (!doc) throw new NotFoundException(`Class not found: ${classId}`);
    return doc as LiveClass & { _id: ObjectId };
  }

  /**
   * OPEN classes only — INVITE_ONLY classes are reachable exclusively via acceptInvitation
   * below. Idempotent on (classId, studentId): a second call for an already-ACTIVE/
   * PENDING_PAYMENT enrollment just returns the existing row rather than erroring or creating
   * a duplicate (the unique index would reject a duplicate insert anyway, but returning the
   * existing enrollment is the correct idempotent behavior, not a 409).
   */
  async enroll(classId: string, studentId: string, email?: string): Promise<EnrollResult> {
    const classDoc = await this.findClass(classId);
    if (classDoc.accessMode !== 'OPEN') {
      throw new ForbiddenException('This class is invite-only — ask the instructor for an invitation link');
    }

    return this.createEnrollment(classDoc, studentId, null, null, email);
  }

  private async createEnrollment(
    classDoc: LiveClass & { _id: ObjectId },
    studentId: string,
    negotiatedPrice: number | null,
    invitationId: ObjectId | null,
    email?: string,
  ): Promise<EnrollResult> {
    // Idempotency lives here, not in each caller (enroll/acceptInvitation both funnel through
    // this) — a real bug found live-verifying Task 39: without this, a payment-service call
    // failing *after* the enrollment row was already inserted (e.g. a transient network error)
    // left a orphaned PENDING_PAYMENT row that crashed the next retry on the unique
    // {classId,studentId} index instead of resuming cleanly. Returning the existing row as-is
    // means a stuck PENDING_PAYMENT needs its own original checkout link to complete, not a
    // fresh payment call — a real limitation, not a full "resume payment" flow, but it turns a
    // 500 into a safe no-op.
    const existing = await this.enrollments().findOne({ classId: classDoc._id, studentId });
    if (existing && (existing.status === 'ACTIVE' || existing.status === 'PENDING_PAYMENT')) {
      return { enrollment: toPublicEnrollment(existing as EnrollmentDocument) };
    }

    if (classDoc.capacity != null) {
      // Counts ACTIVE and PENDING_PAYMENT together — a payment in flight still reserves the
      // seat, so two students racing the last spot can't both end up paying for it.
      const takenSeats = await this.enrollments().countDocuments({
        classId: classDoc._id,
        status: { $in: ['ACTIVE', 'PENDING_PAYMENT'] },
      });
      if (takenSeats >= classDoc.capacity) {
        throw new ConflictException('This class is at capacity');
      }
    }

    const price = negotiatedPrice ?? classDoc.defaultPrice ?? 0;
    const now = new Date();

    if (classDoc.paymentModel === 'FREE') {
      const doc: Enrollment = {
        classId: classDoc._id,
        studentId,
        status: 'ACTIVE',
        negotiatedPrice,
        subscriptionId: null,
        paymentId: null,
        accessUntil: NEVER_EXPIRES,
        invitationId,
        enrolledAt: now,
        endedAt: null,
        endedReason: null,
        createdAt: now,
        updatedAt: now,
      };
      const result = await this.enrollments().insertOne(doc as any);
      const inserted = { ...doc, _id: result.insertedId };
      this.eventPublisher.publishEnrollmentCreated({ enrollmentId: inserted._id.toHexString(), classId: classDoc._id.toHexString(), studentId, paymentModel: 'FREE' });
      return { enrollment: toPublicEnrollment(inserted) };
    }

    // ONE_TIME and RECURRING both need a real price to charge.
    if (!price || price <= 0) {
      throw new BadRequestException('This class requires a price to enroll — none was set');
    }

    const doc: Enrollment = {
      classId: classDoc._id,
      studentId,
      status: 'PENDING_PAYMENT',
      negotiatedPrice,
      subscriptionId: null,
      paymentId: null,
      accessUntil: now, // no access yet — flips forward once payment/subscription confirms
      invitationId,
      enrolledAt: now,
      endedAt: null,
      endedReason: null,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.enrollments().insertOne(doc as any);
    const inserted = { ...doc, _id: result.insertedId };

    if (classDoc.paymentModel === 'ONE_TIME') {
      const payment = await this.paymentServiceClient.initializeOneTimePayment(studentId, classDoc._id.toHexString(), price, classDoc.currency, email);
      return { enrollment: toPublicEnrollment(inserted), authorizationUrl: payment.authorizationUrl };
    }

    // RECURRING
    const subscription = await this.paymentServiceClient.createSubscription(
      studentId,
      classDoc._id.toHexString(),
      price,
      classDoc.currency,
      classDoc.billingInterval ?? 'monthly',
      email,
    );
    return { enrollment: toPublicEnrollment(inserted), authorizationUrl: subscription.authorizationUrl };
  }

  /** INVITE_ONLY classes only, instructor/admin only. */
  async invite(classId: string, invitedBy: string, studentId: string, negotiatedPrice?: number): Promise<ReturnType<typeof toPublicInvitation>> {
    const classDoc = await this.findClass(classId);
    if (classDoc.accessMode !== 'INVITE_ONLY') {
      throw new BadRequestException('Invitations are only for invite-only classes — this class is open for self-enrollment');
    }

    const now = new Date();
    const doc: Invitation = {
      classId: classDoc._id,
      studentId,
      token: randomBytes(24).toString('hex'),
      negotiatedPrice: negotiatedPrice ?? null,
      status: 'pending',
      invitedBy,
      acceptedAt: null,
      createdAt: now,
    };
    const result = await this.invitations().insertOne(doc as any);
    // A real bug found building Task 43: this used to return the raw Mongo document (_id as
    // ObjectId, classId as ObjectId) instead of the same public shape every other list/get here
    // uses — worked by accident over HTTP since ObjectId.toJSON() happens to serialize to a hex
    // string, but the field was still named _id, not id, inconsistent with everything else.
    return toPublicInvitation({ ...doc, _id: result.insertedId });
  }

  /** Task 43's class detail "Invitations" tab — nothing listed a class's invitations before
   * this; only creating one (invite()) and previewing/accepting a single one by token existed. */
  async listInvitations(classId: ObjectId): Promise<ReturnType<typeof toPublicInvitation>[]> {
    const docs = await this.invitations().find({ classId }).sort({ createdAt: -1 }).toArray();
    return docs.map((d) => toPublicInvitation(d as InvitationDocument));
  }

  async acceptInvitation(token: string, studentId: string, email?: string): Promise<EnrollResult> {
    const invitation = await this.invitations().findOne({ token });
    if (!invitation) {
      throw new NotFoundException('Invitation not found or already used');
    }
    if (invitation.status !== 'pending') {
      throw new ConflictException('This invitation has already been used or revoked');
    }
    if (invitation.studentId !== studentId) {
      throw new ForbiddenException('This invitation was issued to a different account');
    }

    const classDoc = await this.classes().findOne({ _id: invitation.classId });
    if (!classDoc) {
      throw new NotFoundException('The class for this invitation no longer exists');
    }

    const result = await this.createEnrollment(
      classDoc as LiveClass & { _id: ObjectId },
      studentId,
      invitation.negotiatedPrice,
      invitation._id,
      email,
    );

    await this.invitations().updateOne({ _id: invitation._id }, { $set: { status: 'accepted', acceptedAt: new Date() } });
    return result;
  }

  /**
   * Public, unauthenticated preview for the invitation-accept page — a visitor needs to see
   * the class/instructor/schedule/price before deciding whether to log in and accept, same as
   * browsing a course before enrolling. Deliberately omits the invited student's identity
   * (`studentId`) from the response — the token itself is the capability, not proof of who
   * it's for; acceptInvitation still checks the caller's real identity against it.
   */
  async getInvitationPreview(token: string): Promise<{ status: Invitation['status']; negotiatedPrice: number | null; class: ReturnType<typeof toPublicClass> }> {
    const invitation = await this.invitations().findOne({ token });
    if (!invitation) {
      throw new NotFoundException('Invitation not found or already used');
    }
    const classDoc = await this.classes().findOne({ _id: invitation.classId });
    if (!classDoc) {
      throw new NotFoundException('The class for this invitation no longer exists');
    }
    return {
      status: invitation.status,
      negotiatedPrice: invitation.negotiatedPrice,
      class: toPublicClass(classDoc as LiveClassDocument),
    };
  }

  /**
   * Student self-cancel. For a RECURRING enrollment, cancels the underlying subscription
   * first, then — per PHASE4.md's access-vs-billing rule — leaves status ACTIVE with
   * accessUntil untouched (already set to the current period end from the last
   * subscription.charged/created event); the expireLapsedEnrollments cron below is what
   * actually flips it to EXPIRED once that date passes. FREE/ONE_TIME enrollments have no
   * billing period to run out the clock on, so they end immediately.
   */
  /**
   * `isAdmin` lets a SUPER_ADMIN/MODERATOR remove *any* student's enrollment (Task 43's
   * enrollments-tab "manual remove" action) — without it, only the owning student could ever
   * cancel their own row, which is correct for the student-facing DELETE but leaves admins with
   * no way to remove a student at all. `enrollment.studentId` (never `callerId`) is what
   * actually gets used for the subscription-cancel call and event payload either way — an
   * admin-initiated removal still cancels the *student's* subscription, not the admin's.
   */
  async cancel(enrollmentId: string, callerId: string, isAdmin: boolean): Promise<EnrollmentDocument> {
    const enrollment = await this.findById(enrollmentId);
    if (!isAdmin && enrollment.studentId !== callerId) {
      throw new ForbiddenException('You do not own this enrollment');
    }
    if (enrollment.status === 'CANCELLED' || enrollment.status === 'EXPIRED') {
      return enrollment;
    }
    const { studentId } = enrollment;
    const endedReason = isAdmin ? 'removed_by_admin' : 'cancelled_by_student';

    if (enrollment.subscriptionId) {
      await this.paymentServiceClient.cancelSubscription(studentId, enrollment.subscriptionId);
      await this.enrollments().updateOne(
        { _id: enrollment._id },
        { $set: { endedReason, updatedAt: new Date() } },
      );
      this.eventPublisher.publishEnrollmentCancelled({
        enrollmentId,
        classId: enrollment.classId.toHexString(),
        studentId,
        accessUntil: enrollment.accessUntil,
      });
      return this.findById(enrollmentId);
    }

    const now = new Date();
    await this.enrollments().updateOne(
      { _id: enrollment._id },
      { $set: { status: 'CANCELLED', accessUntil: now, endedAt: now, endedReason, updatedAt: now } },
    );
    this.eventPublisher.publishEnrollmentCancelled({ enrollmentId, classId: enrollment.classId.toHexString(), studentId, accessUntil: now });
    return this.findById(enrollmentId);
  }

  /**
   * The admin-facing counterpart of listMine() below — Task 43's class detail "Enrollments"
   * tab needs to see who's actually enrolled in a class, which nothing exposed before this
   * (only a student's own `GET /api/classes/enrollments/mine` existed). REMOVED enrollments are
   * excluded — an admin viewing "who's in this class" shouldn't see students already removed
   * from it, same rationale listMine() already applies to a student's own view.
   */
  async listForClass(classId: ObjectId): Promise<{ enrollment: ReturnType<typeof toPublicEnrollment>; student: { id: string; email: string; fullName: string | null } }[]> {
    const docs = await this.enrollments().find({ classId, status: { $ne: 'REMOVED' } }).sort({ enrolledAt: -1 }).toArray();
    const resolved = await Promise.all(
      docs.map(async (enrollment) => {
        try {
          const student = await this.authServiceClient.getUser(enrollment.studentId);
          return { enrollment: toPublicEnrollment(enrollment as EnrollmentDocument), student };
        } catch {
          // A student whose account can't be resolved (deleted, auth-service hiccup) still
          // shows up with a placeholder rather than silently vanishing from the admin's list.
          return {
            enrollment: toPublicEnrollment(enrollment as EnrollmentDocument),
            student: { id: enrollment.studentId, email: 'Unknown', fullName: null },
          };
        }
      }),
    );
    return resolved;
  }

  /**
   * The one thing missing for the whole student-facing "my classes" surface (Task 41): there
   * was no way at all to list a student's own enrollments — `GET /api/classes?mine=true`
   * filters by *instructor*, not student (it's for an instructor viewing classes they teach).
   * Resolves each enrollment's class and soonest upcoming/live session in parallel; N+1 here is
   * deliberate and fine at this scale (a student's own enrollment count), same simplicity
   * tradeoff already made elsewhere in this service (e.g. per-recipient auth-service calls in
   * notification fan-out) rather than a Mongo aggregation pipeline for a handful of rows.
   * Enrollments whose class no longer resolves (defensive — classes are archived, never hard-
   * deleted, so this shouldn't happen in practice) are silently skipped rather than erroring.
   */
  async listMine(studentId: string): Promise<
    { enrollment: ReturnType<typeof toPublicEnrollment>; class: ReturnType<typeof toPublicClass>; nextSession: ReturnType<typeof toPublicSession> | null }[]
  > {
    const docs = await this.enrollments().find({ studentId, status: { $ne: 'REMOVED' } }).sort({ enrolledAt: -1 }).toArray();
    const resolved = await Promise.all(
      docs.map(async (enrollment) => {
        const classDoc = await this.classes().findOne({ _id: enrollment.classId });
        if (!classDoc) return null;
        const upcoming = await this.db
          .collection<LiveSession>('live_sessions')
          .find({ classId: enrollment.classId, status: { $in: ['SCHEDULED', 'LIVE'] } })
          .sort({ startTime: 1 })
          .limit(1)
          .toArray();
        const nextSessionDoc = upcoming[0] ?? null;
        return {
          enrollment: toPublicEnrollment(enrollment as EnrollmentDocument),
          class: toPublicClass(classDoc as LiveClassDocument),
          nextSession: nextSessionDoc ? toPublicSession(nextSessionDoc as LiveSessionDocument) : null,
        };
      }),
    );
    return resolved.filter((r): r is NonNullable<typeof r> => r !== null);
  }

  async findById(id: string): Promise<EnrollmentDocument> {
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      throw new NotFoundException(`Enrollment not found: ${id}`);
    }
    const doc = await this.enrollments().findOne({ _id: objectId });
    if (!doc) throw new NotFoundException(`Enrollment not found: ${id}`);
    return doc as EnrollmentDocument;
  }

  /** The single query every access check (room-reveal, chat posting, materials) funnels
   * through: an enrollment is only "has access right now" if status is ACTIVE/PAUSED AND
   * accessUntil hasn't passed. Never checks payment-service's subscription status directly —
   * that's the whole point of the accessUntil field. */
  async hasAccess(classId: ObjectId, studentId: string): Promise<EnrollmentDocument | null> {
    const doc = await this.enrollments().findOne({
      classId,
      studentId,
      status: { $in: ['ACTIVE', 'PAUSED'] },
      accessUntil: { $gt: new Date() },
    });
    return doc as EnrollmentDocument | null;
  }

  async listActiveStudentIds(classId: ObjectId): Promise<string[]> {
    const docs = await this.enrollments()
      .find({ classId, status: { $in: ['ACTIVE', 'PAUSED'] }, accessUntil: { $gt: new Date() } })
      .project({ studentId: 1 })
      .toArray();
    return docs.map((d) => d.studentId as string);
  }

  // ---- Subscription/payment event consumers (dispatched from ConsumerService) ----

  async handleSubscriptionCreated(payload: { userId: string; itemType: string; itemId: string; subscriptionId: string; currentPeriodEnd: string }): Promise<void> {
    if (payload.itemType !== 'live-class') return;
    await this.activateFromBilling(payload.itemId, payload.userId, payload.subscriptionId, null, payload.currentPeriodEnd);
  }

  async handleSubscriptionCharged(payload: { userId: string; itemType: string; itemId: string; currentPeriodEnd: string }): Promise<void> {
    if (payload.itemType !== 'live-class') return;
    await this.enrollments().updateOne(
      { classId: this.toObjectId(payload.itemId), studentId: payload.userId, status: { $in: ['ACTIVE', 'PENDING_PAYMENT'] } },
      { $set: { accessUntil: new Date(payload.currentPeriodEnd), updatedAt: new Date() } },
    );
  }

  async handleSubscriptionExpired(payload: { userId: string; itemType: string; itemId: string }): Promise<void> {
    if (payload.itemType !== 'live-class') return;
    await this.enrollments().updateOne(
      { classId: this.toObjectId(payload.itemId), studentId: payload.userId, status: { $ne: 'EXPIRED' } },
      { $set: { status: 'EXPIRED', endedAt: new Date(), endedReason: 'payment_failed', updatedAt: new Date() } },
    );
  }

  async handlePaymentCompleted(payload: { userId: string; itemType: string; itemId: string; paymentId: string }): Promise<void> {
    if (payload.itemType !== 'live-class') return;
    await this.activateFromBilling(payload.itemId, payload.userId, null, payload.paymentId, null);
  }

  private toObjectId(id: string): ObjectId {
    return new ObjectId(id);
  }

  private async activateFromBilling(
    classId: string,
    studentId: string,
    subscriptionId: string | null,
    paymentId: string | null,
    currentPeriodEnd: string | null,
  ): Promise<void> {
    const $set: Record<string, unknown> = {
      status: 'ACTIVE',
      accessUntil: currentPeriodEnd ? new Date(currentPeriodEnd) : NEVER_EXPIRES,
      updatedAt: new Date(),
    };
    if (subscriptionId) $set.subscriptionId = subscriptionId;
    if (paymentId) $set.paymentId = paymentId;

    const result = await this.enrollments().updateOne(
      { classId: this.toObjectId(classId), studentId, status: 'PENDING_PAYMENT' },
      { $set },
    );
    if (result.matchedCount === 0) {
      this.logger.warn(`Billing confirmation for class ${classId}/student ${studentId} matched no PENDING_PAYMENT enrollment`);
      return;
    }
    this.eventPublisher.publishEnrollmentCreated({ classId, studentId, paymentModel: subscriptionId ? 'RECURRING' : 'ONE_TIME' });
  }

  /** RECURRING enrollments whose accessUntil has passed (cancelled and the paid period ran
   * out, or a subscription.expired event's accessUntil was already in the past) finally flip
   * to EXPIRED here — the delayed half of the access-vs-billing split. */
  @Cron(CronExpression.EVERY_HOUR)
  async expireLapsedEnrollments(): Promise<void> {
    const result = await this.enrollments().updateMany(
      { status: 'ACTIVE', accessUntil: { $lt: new Date(), $ne: NEVER_EXPIRES } },
      { $set: { status: 'EXPIRED', endedAt: new Date(), updatedAt: new Date() } },
    );
    if (result.modifiedCount > 0) {
      this.logger.log(`Expired ${result.modifiedCount} enrollment(s) whose accessUntil has passed`);
    }
  }
}
