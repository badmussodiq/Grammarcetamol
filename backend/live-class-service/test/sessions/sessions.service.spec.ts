import {ConflictException, ForbiddenException} from '@nestjs/common';
import {ObjectId} from 'mongodb';
import {EnrollmentsService} from '@/enrollments/enrollments.service';
import {LiveClassEventPublisher} from '@/messaging/live-class-event-publisher';
import {VideoProviderRegistry} from '@/providers/video-provider.registry';
import {RoomAccessDeniedException, SessionsService} from '@/sessions/sessions.service';
import {mockCollection, mockDb} from '../mock-collection';

function classDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new ObjectId(),
    title: 'Primary 4 Mathematics',
    instructorId: 'instructor-1',
    videoProvider: 'jitsi',
    accessMode: 'OPEN',
    schedules: [],
    ...overrides,
  } as any;
}

function sessionDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new ObjectId(),
    classId: new ObjectId(),
    instructorId: 'instructor-1',
    startTime: new Date('2026-09-01T15:00:00.000Z'),
    endTime: new Date('2026-09-01T16:00:00.000Z'),
    timezone: 'UTC',
    status: 'SCHEDULED',
    roomId: 'room-abc',
    videoDomain: 'meet.jit.si',
    remindersSent: [],
    ...overrides,
  } as any;
}

describe('SessionsService', () => {
  let sessions: ReturnType<typeof mockCollection>;
  let classes: ReturnType<typeof mockCollection>;
  let db: ReturnType<typeof mockDb>;
  let videoProviderRegistry: { get: jest.Mock };
  let eventPublisher: Record<string, jest.Mock>;
  let enrollmentsService: { hasAccess: jest.Mock };
  let studentNotifier: { notify: jest.Mock };
  let service: SessionsService;

  beforeEach(() => {
    sessions = mockCollection();
    classes = mockCollection();
    db = mockDb({ live_sessions: sessions, classes });
    videoProviderRegistry = { get: jest.fn().mockReturnValue({ createRoom: jest.fn().mockReturnValue({ roomId: 'room-xyz', domain: 'meet.jit.si' }) }) };
    eventPublisher = {
      publishSessionCreated: jest.fn(),
      publishSessionStarted: jest.fn(),
      publishSessionEnded: jest.fn(),
      publishSessionReminder: jest.fn(),
    };
    enrollmentsService = { hasAccess: jest.fn() };
    studentNotifier = { notify: jest.fn().mockResolvedValue(undefined) };

    service = new SessionsService(
      db as any,
      videoProviderRegistry as unknown as VideoProviderRegistry,
      eventPublisher as unknown as LiveClassEventPublisher,
      enrollmentsService as unknown as EnrollmentsService,
      studentNotifier as any,
    );
  });

  describe('createManual — conflict detection', () => {
    it('rejects an overlapping session for the same instructor', async () => {
      sessions.findOne.mockResolvedValueOnce(sessionDoc({ startTime: new Date('2026-09-01T15:30:00Z'), endTime: new Date('2026-09-01T16:30:00Z') }));

      await expect(
        service.createManual(classDoc(), new Date('2026-09-01T15:00:00Z'), new Date('2026-09-01T16:00:00Z'), 'UTC'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(sessions.insertOne).not.toHaveBeenCalled();
    });

    it('allows an adjacent, non-overlapping session (ends exactly when the next starts)', async () => {
      sessions.findOne.mockResolvedValueOnce(null); // no overlap found — the query itself excludes touching-but-not-overlapping
      sessions.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });

      await service.createManual(classDoc(), new Date('2026-09-01T16:00:00Z'), new Date('2026-09-01T17:00:00Z'), 'UTC');

      expect(sessions.insertOne).toHaveBeenCalled();
    });

    it('allows a session on a different day for the same instructor', async () => {
      sessions.findOne.mockResolvedValueOnce(null);
      sessions.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });

      await service.createManual(classDoc(), new Date('2026-09-02T15:00:00Z'), new Date('2026-09-02T16:00:00Z'), 'UTC');

      expect(sessions.insertOne).toHaveBeenCalled();
    });

    it('rejects startTime >= endTime outright, before even checking conflicts', async () => {
      await expect(
        service.createManual(classDoc(), new Date('2026-09-01T16:00:00Z'), new Date('2026-09-01T15:00:00Z'), 'UTC'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(sessions.findOne).not.toHaveBeenCalled();
    });

    it('only SCHEDULED/LIVE sessions count as a conflict — CANCELLED and, critically, ENDED are excluded from the query itself', async () => {
      // Regression test: endTime isn't updated when a session ends early (only
      // actualEndedAt is), so an ENDED session's original window must never keep blocking new
      // bookings — this can only be verified against the query sent to Mongo, since the mock
      // can't reproduce real server-side filtering.
      sessions.findOne.mockResolvedValueOnce(null);
      sessions.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });

      await service.createManual(classDoc(), new Date('2026-09-01T15:00:00Z'), new Date('2026-09-01T16:00:00Z'), 'UTC');

      expect(sessions.findOne).toHaveBeenCalledWith(expect.objectContaining({ status: { $in: ['SCHEDULED', 'LIVE'] } }));
    });
  });

  describe('generateFromSchedules — conflict detection across recurring-generated sessions', () => {
    it('rejects the whole batch (inserts nothing) if any generated occurrence conflicts', async () => {
      const cls = classDoc({
        schedules: [
          { dayOfWeek: new Date().getUTCDay(), startTime: '15:00', endTime: '16:00', timezone: 'UTC', effectiveFrom: new Date(), effectiveUntil: null },
        ],
      });
      // First candidate occurrence conflicts with an existing session.
      sessions.findOne.mockResolvedValueOnce(sessionDoc());

      await expect(service.generateFromSchedules(cls)).rejects.toBeInstanceOf(ConflictException);
      expect(sessions.insertMany).not.toHaveBeenCalled();
    });
  });

  describe('getRoom — four-way authorization', () => {
    it('denies with not-enrolled when the caller has no active enrollment', async () => {
      const cls = classDoc();
      const sess = sessionDoc({ classId: cls._id, status: 'LIVE' });
      sessions.findOne.mockResolvedValueOnce(sess);
      enrollmentsService.hasAccess.mockResolvedValueOnce(null);

      const err = await service.getRoom(cls, sess._id.toHexString(), 'student-1').catch((e) => e);
      expect(err).toBeInstanceOf(RoomAccessDeniedException);
      expect((err as RoomAccessDeniedException).reason).toBe('not-enrolled');
    });

    it('denies with too-early when the session has not gone live yet', async () => {
      const cls = classDoc();
      const sess = sessionDoc({ classId: cls._id, status: 'SCHEDULED' });
      sessions.findOne.mockResolvedValueOnce(sess);
      enrollmentsService.hasAccess.mockResolvedValueOnce({ invitationId: null });

      const err = await service.getRoom(cls, sess._id.toHexString(), 'student-1').catch((e) => e);
      expect((err as RoomAccessDeniedException).reason).toBe('too-early');
    });

    it('denies with session-ended when the session already ended', async () => {
      const cls = classDoc();
      const sess = sessionDoc({ classId: cls._id, status: 'ENDED' });
      sessions.findOne.mockResolvedValueOnce(sess);
      enrollmentsService.hasAccess.mockResolvedValueOnce({ invitationId: null });

      const err = await service.getRoom(cls, sess._id.toHexString(), 'student-1').catch((e) => e);
      expect((err as RoomAccessDeniedException).reason).toBe('session-ended');
    });

    it('denies with invite-not-accepted for an INVITE_ONLY class when the enrollment did not come from an invite', async () => {
      const cls = classDoc({ accessMode: 'INVITE_ONLY' });
      const sess = sessionDoc({ classId: cls._id, status: 'LIVE' });
      sessions.findOne.mockResolvedValueOnce(sess);
      enrollmentsService.hasAccess.mockResolvedValueOnce({ invitationId: null });

      const err = await service.getRoom(cls, sess._id.toHexString(), 'student-1').catch((e) => e);
      expect((err as RoomAccessDeniedException).reason).toBe('invite-not-accepted');
    });

    it('returns the real roomId when every condition is satisfied', async () => {
      const cls = classDoc();
      const sess = sessionDoc({ classId: cls._id, status: 'LIVE', roomId: 'the-real-room' });
      sessions.findOne.mockResolvedValueOnce(sess);
      enrollmentsService.hasAccess.mockResolvedValueOnce({ invitationId: null });

      const room = await service.getRoom(cls, sess._id.toHexString(), 'student-1');
      expect(room.roomId).toBe('the-real-room');
    });
  });

  describe('session lifecycle — ending a session never touches the class', () => {
    it('start() and end() never write to the classes collection (start reads it once, just for the notification fan-out\'s class title)', async () => {
      const sess = sessionDoc({ status: 'SCHEDULED' });
      sessions.findOne.mockResolvedValue(sess);
      sessions.updateOne.mockResolvedValue({});
      classes.findOne.mockResolvedValue(classDoc({ _id: sess.classId }));

      await service.start(sess._id.toHexString(), 'instructor-1', false);
      await service.end(sess._id.toHexString(), 'instructor-1', false);

      // The critical invariant: session lifecycle never mutates the parent class document.
      expect(classes.updateOne).not.toHaveBeenCalled();
      expect(eventPublisher.publishSessionStarted).toHaveBeenCalled();
      expect(eventPublisher.publishSessionEnded).toHaveBeenCalled();
    });

    it('rejects start/end from anyone other than the session\'s instructor', async () => {
      sessions.findOne.mockResolvedValue(sessionDoc({ instructorId: 'instructor-1' }));
      await expect(service.start('507f1f77bcf86cd799439011', 'someone-else', false)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('an admin can start/end a session regardless of its instructorId (Task 43)', async () => {
      const sess = sessionDoc({ status: 'SCHEDULED', instructorId: 'instructor-1' });
      sessions.findOne.mockResolvedValue(sess);
      sessions.updateOne.mockResolvedValue({});
      classes.findOne.mockResolvedValue(classDoc({ _id: sess.classId }));

      await expect(service.start(sess._id.toHexString(), 'admin-1', true)).resolves.toBeUndefined();
      await expect(service.end(sess._id.toHexString(), 'admin-1', true)).resolves.toBeUndefined();
    });

    it('start() fans out a live-class-starting notification via the shared student notifier', async () => {
      const sess = sessionDoc({ status: 'SCHEDULED' });
      sessions.findOne.mockResolvedValue(sess);
      sessions.updateOne.mockResolvedValue({});
      const cls = classDoc({ _id: sess.classId, title: 'Saturday Revision' });
      classes.findOne.mockResolvedValue(cls);

      await service.start(sess._id.toHexString(), 'instructor-1', false);
      // notify() is fire-and-forget (void) inside start() — flush microtasks before asserting.
      await Promise.resolve();

      expect(studentNotifier.notify).toHaveBeenCalledWith(sess.classId, 'Saturday Revision', 'live-class-starting', {});
    });
  });

  describe('sendReminders — already-sent-this-tier guard', () => {
    it('excludes sessions that already have this tier recorded, via the remindersSent query', async () => {
      sessions.__cursor.toArray.mockResolvedValue([]);

      await service.sendReminders();

      // Every tier's query excludes remindersSent already containing that tier.
      const queries = sessions.find.mock.calls.map((call) => call[0]);
      for (const q of queries) {
        expect(q.remindersSent).toEqual({ $ne: expect.any(String) });
      }
      expect(queries).toHaveLength(3); // 24h, 1h, 15min
    });

    it('publishes a reminder and records the tier for a due session', async () => {
      const due = sessionDoc({ remindersSent: [] });
      sessions.__cursor.toArray.mockResolvedValueOnce([due]).mockResolvedValue([]);
      sessions.updateOne.mockResolvedValue({});

      await service.sendReminders();

      expect(eventPublisher.publishSessionReminder).toHaveBeenCalledWith(expect.objectContaining({ sessionId: due._id.toHexString() }));
      expect(sessions.updateOne).toHaveBeenCalledWith(
        { _id: due._id },
        expect.objectContaining({ $addToSet: { remindersSent: '24h' } }),
      );
    });

    it('fans out a live-class-reminder notification for a due session, with the tier label', async () => {
      const due = sessionDoc({ remindersSent: [] });
      sessions.__cursor.toArray.mockResolvedValueOnce([due]).mockResolvedValue([]);
      sessions.updateOne.mockResolvedValue({});
      classes.findOne.mockResolvedValue(classDoc({ _id: due.classId, title: 'Primary 4 Mathematics' }));

      await service.sendReminders();
      await Promise.resolve();

      expect(studentNotifier.notify).toHaveBeenCalledWith(
        due.classId,
        'Primary 4 Mathematics',
        'live-class-reminder',
        expect.objectContaining({ reminderLabel: '24 hours' }),
      );
    });
  });

  describe('reschedule — Task 43 drag-to-reschedule', () => {
    it('moves a SCHEDULED session to a genuinely free slot', async () => {
      const sess = sessionDoc({ status: 'SCHEDULED' });
      sessions.findOne.mockResolvedValueOnce(sess).mockResolvedValueOnce(null).mockResolvedValueOnce({ ...sess, startTime: new Date('2026-09-02T15:00:00Z'), endTime: new Date('2026-09-02T16:00:00Z') });
      sessions.updateOne.mockResolvedValueOnce({});

      const updated = await service.reschedule(
        sess._id.toHexString(), 'instructor-1', false,
        new Date('2026-09-02T15:00:00Z'), new Date('2026-09-02T16:00:00Z'),
      );

      expect(sessions.updateOne).toHaveBeenCalledWith(
        { _id: sess._id },
        expect.objectContaining({ $set: expect.objectContaining({ startTime: new Date('2026-09-02T15:00:00Z') }) }),
      );
      expect(updated.startTime).toEqual(new Date('2026-09-02T15:00:00Z'));
    });

    it('409s and does not write anything when the new time conflicts with another session', async () => {
      const sess = sessionDoc({ status: 'SCHEDULED' });
      const conflicting = sessionDoc({ startTime: new Date('2026-09-01T15:30:00Z'), endTime: new Date('2026-09-01T16:30:00Z') });
      sessions.findOne.mockResolvedValueOnce(sess).mockResolvedValueOnce(conflicting);

      await expect(
        service.reschedule(sess._id.toHexString(), 'instructor-1', false, new Date('2026-09-01T15:00:00Z'), new Date('2026-09-01T16:00:00Z')),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(sessions.updateOne).not.toHaveBeenCalled();
    });

    it('excludes the session itself from the conflict check — rescheduling to its own current slot is not a self-conflict', async () => {
      const sess = sessionDoc({ status: 'SCHEDULED' });
      sessions.findOne.mockResolvedValueOnce(sess).mockResolvedValueOnce(null).mockResolvedValueOnce(sess);
      sessions.updateOne.mockResolvedValueOnce({});

      await service.reschedule(sess._id.toHexString(), 'instructor-1', false, sess.startTime, sess.endTime);

      const conflictQuery = sessions.findOne.mock.calls[1][0];
      expect(conflictQuery._id).toEqual({ $ne: sess._id });
    });

    it('rejects rescheduling a session that is not SCHEDULED', async () => {
      const sess = sessionDoc({ status: 'LIVE' });
      sessions.findOne.mockResolvedValueOnce(sess);
      await expect(
        service.reschedule(sess._id.toHexString(), 'instructor-1', false, new Date('2026-09-02T15:00:00Z'), new Date('2026-09-02T16:00:00Z')),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a non-instructor, non-admin caller', async () => {
      sessions.findOne.mockResolvedValueOnce(sessionDoc({ instructorId: 'instructor-1' }));
      await expect(
        service.reschedule('507f1f77bcf86cd799439011', 'someone-else', false, new Date('2026-09-02T15:00:00Z'), new Date('2026-09-02T16:00:00Z')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('an admin can reschedule regardless of instructorId', async () => {
      const sess = sessionDoc({ status: 'SCHEDULED', instructorId: 'instructor-1' });
      sessions.findOne.mockResolvedValueOnce(sess).mockResolvedValueOnce(null).mockResolvedValueOnce(sess);
      sessions.updateOne.mockResolvedValueOnce({});
      await expect(
        service.reschedule(sess._id.toHexString(), 'admin-1', true, new Date('2026-09-02T15:00:00Z'), new Date('2026-09-02T16:00:00Z')),
      ).resolves.toBeDefined();
    });
  });

  describe('getInstructorAvailability — Task 43 admin edit-form self-conflict fix', () => {
    it('excludes the given class from the query when excludeClassId is passed', async () => {
      const ownClassId = new ObjectId().toHexString();
      sessions.__cursor.toArray.mockResolvedValue([]);

      await service.getInstructorAvailability('instructor-1', new Date('2026-09-01T00:00:00Z'), new Date('2026-09-30T00:00:00Z'), ownClassId);

      const query = sessions.find.mock.calls[0][0];
      expect(query.classId).toEqual({ $ne: new ObjectId(ownClassId) });
    });

    it('does not filter by classId when excludeClassId is omitted (create-mode behavior unchanged)', async () => {
      sessions.__cursor.toArray.mockResolvedValue([]);

      await service.getInstructorAvailability('instructor-1', new Date('2026-09-01T00:00:00Z'), new Date('2026-09-30T00:00:00Z'));

      const query = sessions.find.mock.calls[0][0];
      expect(query.classId).toBeUndefined();
    });
  });
});
