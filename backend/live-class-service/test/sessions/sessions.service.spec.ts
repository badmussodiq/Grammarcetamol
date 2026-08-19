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

      await service.start(sess._id.toHexString(), 'instructor-1');
      await service.end(sess._id.toHexString(), 'instructor-1');

      // The critical invariant: session lifecycle never mutates the parent class document.
      expect(classes.updateOne).not.toHaveBeenCalled();
      expect(eventPublisher.publishSessionStarted).toHaveBeenCalled();
      expect(eventPublisher.publishSessionEnded).toHaveBeenCalled();
    });

    it('rejects start/end from anyone other than the session\'s instructor', async () => {
      sessions.findOne.mockResolvedValue(sessionDoc({ instructorId: 'instructor-1' }));
      await expect(service.start('507f1f77bcf86cd799439011', 'someone-else')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('start() fans out a live-class-starting notification via the shared student notifier', async () => {
      const sess = sessionDoc({ status: 'SCHEDULED' });
      sessions.findOne.mockResolvedValue(sess);
      sessions.updateOne.mockResolvedValue({});
      const cls = classDoc({ _id: sess.classId, title: 'Saturday Revision' });
      classes.findOne.mockResolvedValue(cls);

      await service.start(sess._id.toHexString(), 'instructor-1');
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
});
