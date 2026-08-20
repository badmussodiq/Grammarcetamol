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

      expect(result.enrollment).toBe(existing);
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
});
