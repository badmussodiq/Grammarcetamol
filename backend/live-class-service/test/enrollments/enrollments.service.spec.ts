import {BadRequestException, ConflictException, ForbiddenException, NotFoundException} from '@nestjs/common';
import {ObjectId} from 'mongodb';
import {AuthServiceClient} from '@/clients/auth-service.client';
import {PaymentServiceClient} from '@/clients/payment-service.client';
import {EnrollmentsService} from '@/enrollments/enrollments.service';
import {LiveClassEventPublisher} from '@/messaging/live-class-event-publisher';
import {mockCollection, mockDb} from '../mock-collection';

function classDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new ObjectId(),
    title: 'Advanced Mathematics Group',
    instructorId: 'instructor-1',
    accessMode: 'OPEN',
    paymentModel: 'FREE',
    defaultPrice: null,
    currency: 'NGN',
    billingInterval: null,
    capacity: null,
    ...overrides,
  } as any;
}

describe('EnrollmentsService', () => {
  let enrollments: ReturnType<typeof mockCollection>;
  let invitations: ReturnType<typeof mockCollection>;
  let classes: ReturnType<typeof mockCollection>;
  let db: ReturnType<typeof mockDb>;
  let paymentServiceClient: { initializeOneTimePayment: jest.Mock; createSubscription: jest.Mock; cancelSubscription: jest.Mock };
  let authServiceClient: { getUser: jest.Mock };
  let eventPublisher: Record<string, jest.Mock>;
  let service: EnrollmentsService;

  beforeEach(() => {
    enrollments = mockCollection();
    invitations = mockCollection();
    classes = mockCollection();
    db = mockDb({ enrollments, invitations, classes });
    paymentServiceClient = {
      initializeOneTimePayment: jest.fn(),
      createSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
    };
    authServiceClient = { getUser: jest.fn() };
    eventPublisher = {
      publishEnrollmentCreated: jest.fn(),
      publishEnrollmentCancelled: jest.fn(),
    };

    service = new EnrollmentsService(
      db as any,
      paymentServiceClient as unknown as PaymentServiceClient,
      authServiceClient as unknown as AuthServiceClient,
      eventPublisher as unknown as LiveClassEventPublisher,
    );
  });

  describe('enroll — idempotent free enrollment', () => {
    it('creates a new ACTIVE enrollment on first call', async () => {
      const cls = classDoc();
      classes.findOne.mockResolvedValueOnce(cls);
      enrollments.findOne.mockResolvedValueOnce(null); // no existing enrollment
      enrollments.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });

      const result = await service.enroll(cls._id.toHexString(), 'student-1');

      expect(result.enrollment.status).toBe('ACTIVE');
      expect(paymentServiceClient.initializeOneTimePayment).not.toHaveBeenCalled();
    });

    it('returns the existing enrollment on a second call rather than creating a duplicate', async () => {
      const cls = classDoc();
      const existing = { _id: new ObjectId(), status: 'ACTIVE', classId: cls._id, studentId: 'student-1' };
      classes.findOne.mockResolvedValueOnce(cls);
      enrollments.findOne.mockResolvedValueOnce(existing);

      const result = await service.enroll(cls._id.toHexString(), 'student-1');

      // Public shape (id, not _id) — same "never return the raw Mongo doc" convention every
      // other list/get response in this service follows; this enroll()/acceptInvitation() path
      // was a real bug found live-verifying Task 45 (leaked `_id` instead of `id`).
      expect(result.enrollment).toEqual({ id: existing._id.toHexString(), status: 'ACTIVE', classId: cls._id.toHexString(), studentId: 'student-1' });
      expect(enrollments.insertOne).not.toHaveBeenCalled();
    });
  });

  describe('enroll — access mode and capacity', () => {
    it('rejects self-enrollment into an INVITE_ONLY class', async () => {
      classes.findOne.mockResolvedValueOnce(classDoc({ accessMode: 'INVITE_ONLY' }));
      await expect(service.enroll(new ObjectId().toHexString(), 'student-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects enrollment once capacity is reached', async () => {
      const cls = classDoc({ capacity: 2 });
      classes.findOne.mockResolvedValueOnce(cls);
      enrollments.findOne.mockResolvedValueOnce(null);
      enrollments.countDocuments.mockResolvedValueOnce(2); // already full

      await expect(service.enroll(cls._id.toHexString(), 'student-1')).rejects.toBeInstanceOf(ConflictException);
      expect(enrollments.insertOne).not.toHaveBeenCalled();
    });

    it('allows enrollment when under capacity', async () => {
      const cls = classDoc({ capacity: 30 });
      classes.findOne.mockResolvedValueOnce(cls);
      enrollments.findOne.mockResolvedValueOnce(null);
      enrollments.countDocuments.mockResolvedValueOnce(29);
      enrollments.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });

      const result = await service.enroll(cls._id.toHexString(), 'student-1');
      expect(result.enrollment.status).toBe('ACTIVE');
    });
  });

  describe('enroll — ONE_TIME and RECURRING billing branches', () => {
    it('ONE_TIME creates a PENDING_PAYMENT enrollment and returns the authorization URL', async () => {
      const cls = classDoc({ paymentModel: 'ONE_TIME', defaultPrice: 25000 });
      classes.findOne.mockResolvedValueOnce(cls);
      enrollments.findOne.mockResolvedValueOnce(null);
      enrollments.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });
      paymentServiceClient.initializeOneTimePayment.mockResolvedValueOnce({ authorizationUrl: 'https://checkout', reference: 'pay_1' });

      const result = await service.enroll(cls._id.toHexString(), 'student-1', 'a@b.com');

      expect(result.enrollment.status).toBe('PENDING_PAYMENT');
      expect(result.authorizationUrl).toBe('https://checkout');
      expect(paymentServiceClient.initializeOneTimePayment).toHaveBeenCalledWith('student-1', cls._id.toHexString(), 25000, 'NGN', 'a@b.com');
    });

    it('RECURRING creates a PENDING_PAYMENT enrollment via a subscription', async () => {
      const cls = classDoc({ paymentModel: 'RECURRING', defaultPrice: 50000, billingInterval: 'monthly' });
      classes.findOne.mockResolvedValueOnce(cls);
      enrollments.findOne.mockResolvedValueOnce(null);
      enrollments.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });
      paymentServiceClient.createSubscription.mockResolvedValueOnce({ authorizationUrl: 'https://checkout' });

      const result = await service.enroll(cls._id.toHexString(), 'student-1', 'a@b.com');

      expect(result.enrollment.status).toBe('PENDING_PAYMENT');
      expect(paymentServiceClient.createSubscription).toHaveBeenCalledWith('student-1', cls._id.toHexString(), 50000, 'NGN', 'monthly', 'a@b.com');
    });

    it('rejects a paid class with no resolvable price', async () => {
      const cls = classDoc({ paymentModel: 'ONE_TIME', defaultPrice: null });
      classes.findOne.mockResolvedValueOnce(cls);
      enrollments.findOne.mockResolvedValueOnce(null);
      await expect(service.enroll(cls._id.toHexString(), 'student-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('cancel — accessUntil vs. subscription.status divergence', () => {
    it('a RECURRING enrollment stays ACTIVE with accessUntil untouched after cancel — access is not immediately revoked', async () => {
      const futureAccessUntil = new Date('2026-09-19T00:00:00.000Z');
      const enrollment = {
        _id: new ObjectId(),
        classId: new ObjectId(),
        studentId: 'student-1',
        status: 'ACTIVE',
        subscriptionId: 'sub-1',
        accessUntil: futureAccessUntil,
      };
      enrollments.findOne.mockResolvedValueOnce(enrollment).mockResolvedValueOnce({ ...enrollment, endedReason: 'cancelled_by_student' });
      enrollments.updateOne.mockResolvedValueOnce({});

      const result = await service.cancel(enrollment._id.toHexString(), 'student-1', false);

      expect(paymentServiceClient.cancelSubscription).toHaveBeenCalledWith('student-1', 'sub-1');
      // The critical assertion: status is still ACTIVE, accessUntil is untouched — cancelling
      // the subscription does not itself end access.
      expect(result.status).toBe('ACTIVE');
      expect(result.accessUntil).toEqual(futureAccessUntil);
      const updateCall = enrollments.updateOne.mock.calls[0][1];
      expect(updateCall.$set.status).toBeUndefined();
      expect(updateCall.$set.accessUntil).toBeUndefined();
    });

    it('a FREE/ONE_TIME enrollment (no subscription) ends access immediately on cancel', async () => {
      const enrollment = {
        _id: new ObjectId(),
        classId: new ObjectId(),
        studentId: 'student-1',
        status: 'ACTIVE',
        subscriptionId: null,
        accessUntil: new Date('2100-01-01T00:00:00.000Z'),
      };
      enrollments.findOne.mockResolvedValueOnce(enrollment).mockResolvedValueOnce({ ...enrollment, status: 'CANCELLED' });
      enrollments.updateOne.mockResolvedValueOnce({});

      const result = await service.cancel(enrollment._id.toHexString(), 'student-1', false);

      expect(paymentServiceClient.cancelSubscription).not.toHaveBeenCalled();
      expect(result.status).toBe('CANCELLED');
    });

    it('rejects cancelling someone else\'s enrollment', async () => {
      enrollments.findOne.mockResolvedValueOnce({ _id: new ObjectId(), studentId: 'other-student', status: 'ACTIVE' });
      await expect(service.cancel(new ObjectId().toHexString(), 'student-1', false)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('an admin can cancel any student\'s enrollment, tagged with a distinct endedReason (Task 43)', async () => {
      const enrollment = {
        _id: new ObjectId(),
        classId: new ObjectId(),
        studentId: 'student-1',
        status: 'ACTIVE',
        subscriptionId: null,
        accessUntil: new Date('2100-01-01T00:00:00.000Z'),
      };
      enrollments.findOne.mockResolvedValueOnce(enrollment).mockResolvedValueOnce({ ...enrollment, status: 'CANCELLED' });
      enrollments.updateOne.mockResolvedValueOnce({});

      const result = await service.cancel(enrollment._id.toHexString(), 'admin-1', true);

      expect(result.status).toBe('CANCELLED');
      const updateCall = enrollments.updateOne.mock.calls[0][1];
      expect(updateCall.$set.endedReason).toBe('removed_by_admin');
    });
  });

  describe('hasAccess', () => {
    it('never checks anything outside its own accessUntil/status query', async () => {
      enrollments.findOne.mockResolvedValueOnce({ status: 'ACTIVE' });
      await service.hasAccess(new ObjectId(), 'student-1');
      const query = enrollments.findOne.mock.calls[0][0];
      expect(query.status).toEqual({ $in: ['ACTIVE', 'PAUSED'] });
      expect(query.accessUntil).toEqual({ $gt: expect.any(Date) });
    });
  });

  describe('listForClass — Task 43 admin enrollments tab', () => {
    it('resolves each enrollment to its student, excluding REMOVED rows', async () => {
      const classId = new ObjectId();
      const enrollment = { _id: new ObjectId(), classId, studentId: 'student-1', status: 'ACTIVE' };
      enrollments.__cursor.toArray.mockResolvedValueOnce([enrollment]);
      authServiceClient.getUser.mockResolvedValueOnce({ id: 'student-1', email: 's1@example.com', fullName: 'Student One' });

      const result = await service.listForClass(classId);

      expect(result).toHaveLength(1);
      expect(result[0].student).toEqual({ id: 'student-1', email: 's1@example.com', fullName: 'Student One' });
      expect(result[0].enrollment.id).toBe(enrollment._id.toHexString());
      const query = enrollments.find.mock.calls[0][0];
      expect(query.status).toEqual({ $ne: 'REMOVED' });
    });

    it('shows a placeholder rather than dropping a row when the student account can\'t be resolved', async () => {
      const classId = new ObjectId();
      const enrollment = { _id: new ObjectId(), classId, studentId: 'student-1', status: 'ACTIVE' };
      enrollments.__cursor.toArray.mockResolvedValueOnce([enrollment]);
      authServiceClient.getUser.mockRejectedValueOnce(new Error('not found'));

      const result = await service.listForClass(classId);

      expect(result).toHaveLength(1);
      expect(result[0].student.email).toBe('Unknown');
    });
  });

  describe('invite / listInvitations — Task 43 admin invitations tab', () => {
    it('invite() returns the same public shape (id/classId as hex strings) as everything else', async () => {
      const cls = classDoc({ accessMode: 'INVITE_ONLY' });
      classes.findOne.mockResolvedValueOnce(cls);
      invitations.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });

      const result = await service.invite(cls._id.toHexString(), 'admin-1', 'student-1', 12000);

      expect(result.id).toBeDefined();
      expect(result.classId).toBe(cls._id.toHexString());
      expect((result as any)._id).toBeUndefined();
    });

    it('listInvitations returns every invitation for a class, most recent first', async () => {
      const classId = new ObjectId();
      const inv = { _id: new ObjectId(), classId, studentId: 'student-1', token: 'tok', status: 'pending', negotiatedPrice: null, invitedBy: 'admin-1', acceptedAt: null, createdAt: new Date() };
      invitations.__cursor.toArray.mockResolvedValueOnce([inv]);

      const result = await service.listInvitations(classId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(inv._id.toHexString());
      expect(result[0].token).toBe('tok');
      const sortCall = invitations.__cursor.sort.mock.calls[0][0];
      expect(sortCall).toEqual({ createdAt: -1 });
    });
  });

  describe('listMine', () => {
    it('resolves each enrollment to its class and soonest upcoming/live session', async () => {
      const cls = classDoc({ title: 'Saturday Chemistry' });
      const enrollment = {
        _id: new ObjectId(),
        classId: cls._id,
        studentId: 'student-1',
        status: 'ACTIVE',
        accessUntil: new Date('2100-01-01T00:00:00.000Z'),
        negotiatedPrice: null,
        subscriptionId: null,
        paymentId: null,
        invitationId: null,
        enrolledAt: new Date(),
      };
      const liveSessions = mockCollection();
      db.collection.mockImplementation((name: string) => (name === 'live_sessions' ? liveSessions : ({ enrollments, invitations, classes } as Record<string, any>)[name]));
      enrollments.__cursor.toArray.mockResolvedValueOnce([enrollment]);
      classes.findOne.mockResolvedValueOnce(cls);
      const session = { _id: new ObjectId(), classId: cls._id, startTime: new Date('2026-09-01T15:00:00Z'), status: 'SCHEDULED' };
      liveSessions.__cursor.toArray.mockResolvedValueOnce([session]);

      const result = await service.listMine('student-1');

      expect(result).toHaveLength(1);
      expect(result[0].class.title).toBe('Saturday Chemistry');
      expect(result[0].nextSession?.id).toBe(session._id.toHexString());
    });

    it('skips an enrollment whose class no longer resolves rather than throwing', async () => {
      const enrollment = { _id: new ObjectId(), classId: new ObjectId(), studentId: 'student-1', status: 'ACTIVE' };
      const liveSessions = mockCollection();
      db.collection.mockImplementation((name: string) => (name === 'live_sessions' ? liveSessions : ({ enrollments, invitations, classes } as Record<string, any>)[name]));
      enrollments.__cursor.toArray.mockResolvedValueOnce([enrollment]);
      classes.findOne.mockResolvedValueOnce(null);

      const result = await service.listMine('student-1');
      expect(result).toEqual([]);
    });
  });

  describe('invitations', () => {
    it('rejects inviting into an OPEN class', async () => {
      classes.findOne.mockResolvedValueOnce(classDoc({ accessMode: 'OPEN' }));
      await expect(service.invite(new ObjectId().toHexString(), 'admin-1', 'student-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects accepting an invitation issued to a different account', async () => {
      invitations.findOne.mockResolvedValueOnce({ _id: new ObjectId(), token: 'tok', status: 'pending', studentId: 'someone-else', classId: new ObjectId() });
      await expect(service.acceptInvitation('tok', 'student-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('preview returns the class and price but never the invited student\'s identity', async () => {
      const cls = classDoc({ accessMode: 'INVITE_ONLY', paymentModel: 'ONE_TIME', defaultPrice: 15000 });
      invitations.findOne.mockResolvedValueOnce({
        _id: new ObjectId(),
        token: 'tok',
        status: 'pending',
        studentId: 'the-invited-student',
        negotiatedPrice: 12000,
        classId: cls._id,
      });
      classes.findOne.mockResolvedValueOnce(cls);

      const result = await service.getInvitationPreview('tok');

      expect(result.status).toBe('pending');
      expect(result.negotiatedPrice).toBe(12000);
      expect(result.class.id).toBe(cls._id.toHexString());
      expect(JSON.stringify(result)).not.toContain('the-invited-student');
    });

    it('preview 404s for an unknown token', async () => {
      invitations.findOne.mockResolvedValueOnce(null);
      await expect(service.getInvitationPreview('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // Task 45 — the RabbitMQ consumer handlers dispatched from LiveClassConsumerService and the
  // hourly expiry cron had zero coverage before this: every existing test in this file mocks
  // the enrollment's own service methods, never the billing-event side of the access-vs-billing
  // split. Live-verified once via a real HTTP + real webhook + real RabbitMQ round trip in
  // liveclass-subscription-lifecycle.integration.spec.ts; these are the fast, exhaustive
  // edge-case coverage that a live round trip can't practically provide (wrong itemType, no
  // matching row, the cron's own filter shape).
  describe('subscription/payment event consumers (dispatched from LiveClassConsumerService)', () => {
    describe('handleSubscriptionCreated / handlePaymentCompleted — activateFromBilling', () => {
      it('ignores an event for a different itemType', async () => {
        await service.handleSubscriptionCreated({ userId: 's1', itemType: 'course', itemId: 'c1', subscriptionId: 'sub1', currentPeriodEnd: new Date().toISOString() });
        expect(enrollments.updateOne).not.toHaveBeenCalled();
      });

      it('activates a PENDING_PAYMENT RECURRING enrollment, setting accessUntil and subscriptionId', async () => {
        const classId = new ObjectId();
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        enrollments.updateOne.mockResolvedValueOnce({ matchedCount: 1 });

        await service.handleSubscriptionCreated({ userId: 'student-1', itemType: 'live-class', itemId: classId.toHexString(), subscriptionId: 'sub-abc', currentPeriodEnd: periodEnd });

        const [filter, update] = enrollments.updateOne.mock.calls[0];
        expect(filter).toMatchObject({ studentId: 'student-1', status: 'PENDING_PAYMENT' });
        expect(update.$set).toMatchObject({ status: 'ACTIVE', subscriptionId: 'sub-abc', accessUntil: new Date(periodEnd) });
        expect(eventPublisher.publishEnrollmentCreated).toHaveBeenCalledWith(expect.objectContaining({ paymentModel: 'RECURRING' }));
      });

      it('activates a PENDING_PAYMENT ONE_TIME enrollment via handlePaymentCompleted, with NEVER_EXPIRES accessUntil and no subscriptionId', async () => {
        enrollments.updateOne.mockResolvedValueOnce({ matchedCount: 1 });

        await service.handlePaymentCompleted({ userId: 'student-1', itemType: 'live-class', itemId: new ObjectId().toHexString(), paymentId: 'pay-abc' });

        const [, update] = enrollments.updateOne.mock.calls[0];
        expect(update.$set.status).toBe('ACTIVE');
        expect(update.$set.paymentId).toBe('pay-abc');
        expect(update.$set.subscriptionId).toBeUndefined();
        expect(update.$set.accessUntil.getUTCFullYear()).toBe(2100); // NEVER_EXPIRES
        expect(eventPublisher.publishEnrollmentCreated).toHaveBeenCalledWith(expect.objectContaining({ paymentModel: 'ONE_TIME' }));
      });

      it('logs and does not publish when no PENDING_PAYMENT enrollment matches (a lost/delayed insert)', async () => {
        enrollments.updateOne.mockResolvedValueOnce({ matchedCount: 0 });

        await service.handleSubscriptionCreated({ userId: 'student-1', itemType: 'live-class', itemId: new ObjectId().toHexString(), subscriptionId: 'sub-abc', currentPeriodEnd: new Date().toISOString() });

        expect(eventPublisher.publishEnrollmentCreated).not.toHaveBeenCalled();
      });
    });

    describe('handleSubscriptionCharged — renewal extends accessUntil without touching status', () => {
      it('ignores an event for a different itemType', async () => {
        await service.handleSubscriptionCharged({ userId: 's1', itemType: 'course', itemId: 'c1', currentPeriodEnd: new Date().toISOString() });
        expect(enrollments.updateOne).not.toHaveBeenCalled();
      });

      it('extends accessUntil for an ACTIVE or PENDING_PAYMENT enrollment, no status change', async () => {
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        enrollments.updateOne.mockResolvedValueOnce({ matchedCount: 1 });

        await service.handleSubscriptionCharged({ userId: 'student-1', itemType: 'live-class', itemId: new ObjectId().toHexString(), currentPeriodEnd: periodEnd });

        const [filter, update] = enrollments.updateOne.mock.calls[0];
        expect(filter.status).toEqual({ $in: ['ACTIVE', 'PENDING_PAYMENT'] });
        expect(update.$set.accessUntil).toEqual(new Date(periodEnd));
        expect(update.$set.status).toBeUndefined();
      });
    });

    describe('handleSubscriptionExpired — a failed-payment escalation, distinct from voluntary cancel', () => {
      it('ignores an event for a different itemType', async () => {
        await service.handleSubscriptionExpired({ userId: 's1', itemType: 'course', itemId: 'c1' });
        expect(enrollments.updateOne).not.toHaveBeenCalled();
      });

      it('flips a non-EXPIRED enrollment to EXPIRED with endedReason payment_failed', async () => {
        enrollments.updateOne.mockResolvedValueOnce({ matchedCount: 1 });

        await service.handleSubscriptionExpired({ userId: 'student-1', itemType: 'live-class', itemId: new ObjectId().toHexString() });

        const [filter, update] = enrollments.updateOne.mock.calls[0];
        expect(filter.status).toEqual({ $ne: 'EXPIRED' });
        expect(update.$set).toMatchObject({ status: 'EXPIRED', endedReason: 'payment_failed' });
      });
    });

    describe('expireLapsedEnrollments — the hourly cron that catches up the status field', () => {
      it('flips every ACTIVE enrollment whose accessUntil has passed to EXPIRED, excluding NEVER_EXPIRES rows', async () => {
        enrollments.updateMany.mockResolvedValueOnce({ modifiedCount: 3 });

        await service.expireLapsedEnrollments();

        const [filter, update] = enrollments.updateMany.mock.calls[0];
        expect(filter.status).toBe('ACTIVE');
        expect(filter.accessUntil.$lt).toBeInstanceOf(Date);
        // NEVER_EXPIRES (2100-01-01) is explicitly excluded — a FREE/ONE_TIME enrollment must
        // never be swept into EXPIRED just because it's "in the past" relative to some future
        // NEVER_EXPIRES-adjacent bug; accessUntil.$ne pins the exclusion to the exact sentinel.
        expect(filter.accessUntil.$ne).toEqual(new Date('2100-01-01T00:00:00.000Z'));
        expect(update.$set.status).toBe('EXPIRED');
      });

      it('is a no-op when nothing has lapsed', async () => {
        enrollments.updateMany.mockResolvedValueOnce({ modifiedCount: 0 });
        await expect(service.expireLapsedEnrollments()).resolves.toBeUndefined();
      });
    });
  });
});
