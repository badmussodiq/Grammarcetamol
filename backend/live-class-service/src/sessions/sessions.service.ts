import {ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, OnApplicationBootstrap} from '@nestjs/common';
import {Cron, CronExpression} from '@nestjs/schedule';
import type {Collection, Db} from 'mongodb';
import {ObjectId} from 'mongodb';
import {MONGO_DB} from '@/config/database.module';
import {EnrolledStudentNotifier} from '@/enrollments/enrolled-student-notifier.service';
import {EnrollmentsService} from '@/enrollments/enrollments.service';
import {LiveClassEventPublisher} from '@/messaging/live-class-event-publisher';
import {VideoProviderRegistry} from '@/providers/video-provider.registry';
import type {ClassSchedule, LiveClass, LiveClassDocument} from '@/classes/class.types';
import type {LiveSession, LiveSessionDocument, ReminderTier} from './session.types';
import {toPublicSession} from './session.types';

export type RoomDenialReason = 'not-enrolled' | 'too-early' | 'session-ended' | 'invite-not-accepted';

export class RoomAccessDeniedException extends ForbiddenException {
  constructor(public readonly reason: RoomDenialReason) {
    super(RoomAccessDeniedException.messageFor(reason));
  }

  private static messageFor(reason: RoomDenialReason): string {
    switch (reason) {
      case 'not-enrolled':
        return 'You are not enrolled in this class';
      case 'too-early':
        return 'This session has not started yet';
      case 'session-ended':
        return 'This session has already ended';
      case 'invite-not-accepted':
        return 'Access to this class requires an accepted invitation';
    }
  }
}

// How far forward the schedule-derived session window reaches, and how the weekly extension
// cron keeps it topped up — see PHASE4.md's Scheduling conflict detection section: the
// generated live_sessions collection is the single source of truth for conflict-checking, not
// the schedules[] templates, so this window has to actually exist as real rows, not be
// computed on the fly.
const GENERATION_WEEKS = 10;
// A session nobody ever started, past its end time by this much, is force-ended by the cron
// below so a forgotten SCHEDULED/LIVE row doesn't linger forever.
const AUTO_END_GRACE_MINUTES = 30;

export interface ConflictDetail {
  sessionId: string;
  startTime: Date;
  endTime: Date;
}

@Injectable()
export class SessionsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @Inject(MONGO_DB) private readonly db: Db,
    private readonly videoProviderRegistry: VideoProviderRegistry,
    private readonly eventPublisher: LiveClassEventPublisher,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly studentNotifier: EnrolledStudentNotifier,
  ) {}

  private sessions(): Collection<LiveSession> {
    return this.db.collection<LiveSession>('live_sessions');
  }

  private classes(): Collection<LiveClass> {
    return this.db.collection<LiveClass>('classes');
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.sessions().createIndex({ classId: 1, startTime: 1 });
    await this.sessions().createIndex({ instructorId: 1, startTime: 1 });
    await this.sessions().createIndex({ status: 1 });
  }

  /**
   * The single conflict-check every code path funnels through — bulk schedule generation,
   * manual one-off creation, and (implicitly) any future reschedule. Adjacent-but-not-
   * overlapping (one ends exactly when the next starts) is allowed; any real overlap on the
   * half-open [startTime, endTime) interval is rejected.
   */
  private async findConflict(
    instructorId: string,
    startTime: Date,
    endTime: Date,
    excludeSessionId?: ObjectId,
  ): Promise<ConflictDetail | null> {
    const query: Record<string, unknown> = {
      instructorId,
      status: { $ne: 'CANCELLED' },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    };
    if (excludeSessionId) {
      query._id = { $ne: excludeSessionId };
    }
    const existing = await this.sessions().findOne(query);
    if (!existing) return null;
    return { sessionId: existing._id.toHexString(), startTime: existing.startTime, endTime: existing.endTime };
  }

  /** Generates the rolling GENERATION_WEEKS window of sessions from a class's schedules[]
   * templates. All-or-nothing: if ANY candidate occurrence conflicts with an existing session
   * for this instructor, nothing is inserted and a ConflictException is thrown — same
   * discipline as a single manual booking, just checked across the whole batch up front. */
  async generateFromSchedules(classDoc: LiveClassDocument): Promise<LiveSessionDocument[]> {
    const candidates = this.expandSchedulesToOccurrences(classDoc.schedules, GENERATION_WEEKS);
    if (candidates.length === 0) return [];

    for (const candidate of candidates) {
      const conflict = await this.findConflict(classDoc.instructorId, candidate.startTime, candidate.endTime);
      if (conflict) {
        throw new ConflictException({
          message: `Schedule conflict: ${classDoc.instructorId} already has a session from ${conflict.startTime.toISOString()} to ${conflict.endTime.toISOString()}`,
          conflict,
        });
      }
    }

    const provider = this.videoProviderRegistry.get(classDoc.videoProvider);
    const now = new Date();
    const docs: LiveSession[] = candidates.map((c) => {
      const room = provider.createRoom({ classTitle: classDoc.title });
      return {
        classId: classDoc._id,
        instructorId: classDoc.instructorId,
        startTime: c.startTime,
        endTime: c.endTime,
        timezone: c.timezone,
        status: 'SCHEDULED',
        roomId: room.roomId,
        videoDomain: room.domain,
        actualStartedAt: null,
        actualEndedAt: null,
        recordingUrl: null,
        createdFrom: 'schedule',
        remindersSent: [],
        createdAt: now,
        updatedAt: now,
      };
    });

    const result = await this.sessions().insertMany(docs as any);
    const inserted = docs.map((doc, i) => ({ ...doc, _id: Object.values(result.insertedIds)[i] as ObjectId }));
    for (const doc of inserted) {
      this.eventPublisher.publishSessionCreated({ sessionId: doc._id.toHexString(), classId: classDoc._id.toHexString(), startTime: doc.startTime });
    }
    return inserted;
  }

  /** Expands weekly recurrence templates into concrete occurrences within the next `weeks`. */
  private expandSchedulesToOccurrences(schedules: ClassSchedule[], weeks: number): { startTime: Date; endTime: Date; timezone: string }[] {
    const occurrences: { startTime: Date; endTime: Date; timezone: string }[] = [];
    const now = new Date();
    const horizon = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);

    for (const schedule of schedules) {
      const from = schedule.effectiveFrom > now ? schedule.effectiveFrom : now;
      const until = schedule.effectiveUntil && schedule.effectiveUntil < horizon ? schedule.effectiveUntil : horizon;

      const cursor = new Date(from);
      // Walk forward day-by-day rather than jumping straight to the next matching weekday —
      // simpler to reason about correctly than modular date arithmetic, and this only runs
      // over a ~10-week window so the extra iterations are cheap.
      while (cursor <= until) {
        if (cursor.getUTCDay() === schedule.dayOfWeek) {
          const [startH, startM] = schedule.startTime.split(':').map(Number);
          const [endH, endM] = schedule.endTime.split(':').map(Number);
          const startTime = new Date(cursor);
          startTime.setUTCHours(startH, startM, 0, 0);
          const endTime = new Date(cursor);
          endTime.setUTCHours(endH, endM, 0, 0);
          if (startTime > now) {
            occurrences.push({ startTime, endTime, timezone: schedule.timezone });
          }
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
    return occurrences;
  }

  /** Manual one-off session — same conflict check, single occurrence, createdFrom: 'manual'. */
  async createManual(classDoc: LiveClassDocument, startTime: Date, endTime: Date, timezone: string): Promise<LiveSessionDocument> {
    if (startTime >= endTime) {
      throw new ConflictException('startTime must be before endTime');
    }
    const conflict = await this.findConflict(classDoc.instructorId, startTime, endTime);
    if (conflict) {
      throw new ConflictException({
        message: `Schedule conflict: ${classDoc.instructorId} already has a session from ${conflict.startTime.toISOString()} to ${conflict.endTime.toISOString()}`,
        conflict,
      });
    }

    const provider = this.videoProviderRegistry.get(classDoc.videoProvider);
    const room = provider.createRoom({ classTitle: classDoc.title });
    const now = new Date();
    const doc: LiveSession = {
      classId: classDoc._id,
      instructorId: classDoc.instructorId,
      startTime,
      endTime,
      timezone,
      status: 'SCHEDULED',
      roomId: room.roomId,
      videoDomain: room.domain,
      actualStartedAt: null,
      actualEndedAt: null,
      recordingUrl: null,
      createdFrom: 'manual',
      remindersSent: [],
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.sessions().insertOne(doc as any);
    const inserted = { ...doc, _id: result.insertedId };
    this.eventPublisher.publishSessionCreated({ sessionId: inserted._id.toHexString(), classId: classDoc._id.toHexString(), startTime });
    return inserted;
  }

  async listForClass(classId: ObjectId): Promise<ReturnType<typeof toPublicSession>[]> {
    const docs = await this.sessions().find({ classId }).sort({ startTime: 1 }).toArray();
    return docs.map((d) => toPublicSession(d as LiveSessionDocument));
  }

  async findById(sessionId: string): Promise<LiveSessionDocument> {
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(sessionId);
    } catch {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }
    const doc = await this.sessions().findOne({ _id: objectId });
    if (!doc) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }
    return doc as LiveSessionDocument;
  }

  async start(sessionId: string, instructorId: string): Promise<void> {
    const session = await this.findById(sessionId);
    if (session.instructorId !== instructorId) {
      throw new ForbiddenException('Only the instructor for this session can start it');
    }
    if (session.status !== 'SCHEDULED') {
      throw new ConflictException(`Cannot start a session in status ${session.status}`);
    }
    await this.sessions().updateOne({ _id: session._id }, { $set: { status: 'LIVE', actualStartedAt: new Date(), updatedAt: new Date() } });
    this.eventPublisher.publishSessionStarted({ sessionId, classId: session.classId.toHexString() });

    const classDoc = await this.classes().findOne({ _id: session.classId });
    if (classDoc) {
      void this.studentNotifier.notify(session.classId, classDoc.title, 'live-class-starting', {});
    }
  }

  async end(sessionId: string, instructorId: string): Promise<void> {
    const session = await this.findById(sessionId);
    if (session.instructorId !== instructorId) {
      throw new ForbiddenException('Only the instructor for this session can end it');
    }
    if (session.status !== 'LIVE' && session.status !== 'SCHEDULED') {
      throw new ConflictException(`Cannot end a session in status ${session.status}`);
    }
    // Ending never touches the parent class's own status — session and class lifecycles are
    // fully independent, per PHASE4.md's Domain Model.
    await this.sessions().updateOne({ _id: session._id }, { $set: { status: 'ENDED', actualEndedAt: new Date(), updatedAt: new Date() } });
    this.eventPublisher.publishSessionEnded({ sessionId, classId: session.classId.toHexString() });
  }

  /**
   * The only method in this service (or anywhere in this codebase) that ever returns a real
   * roomId — backend-enforces all four conditions from PHASE4.md's "Join-button + chat
   * gating" section, in the order a caller would naturally hit them, distinguishing each
   * failure reason rather than a single opaque 403.
   */
  async getRoom(classDoc: LiveClassDocument, sessionId: string, studentId: string): Promise<{ roomId: string; domain: string }> {
    const session = await this.findById(sessionId);
    if (!session.classId.equals(classDoc._id)) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    const enrollment = await this.enrollmentsService.hasAccess(classDoc._id, studentId);
    if (!enrollment) {
      throw new RoomAccessDeniedException('not-enrolled');
    }
    if (classDoc.accessMode === 'INVITE_ONLY' && !enrollment.invitationId) {
      throw new RoomAccessDeniedException('invite-not-accepted');
    }
    if (session.status === 'ENDED' || session.status === 'CANCELLED') {
      throw new RoomAccessDeniedException('session-ended');
    }
    if (session.status !== 'LIVE') {
      throw new RoomAccessDeniedException('too-early');
    }

    return { roomId: session.roomId, domain: session.videoDomain };
  }

  /** Real-time conflict check backing the admin create/edit form. */
  async getInstructorAvailability(instructorId: string, from: Date, to: Date): Promise<ConflictDetail[]> {
    const docs = await this.sessions()
      .find({ instructorId, status: { $ne: 'CANCELLED' }, startTime: { $lt: to }, endTime: { $gt: from } })
      .sort({ startTime: 1 })
      .toArray();
    return docs.map((d) => ({ sessionId: d._id.toHexString(), startTime: d.startTime, endTime: d.endTime }));
  }

  /** A session nobody ever started, past its end time plus grace, is force-ended so a stale
   * SCHEDULED row doesn't linger and confuse the "is this session live" checks forever. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoEndStaleSessions(): Promise<void> {
    const cutoff = new Date(Date.now() - AUTO_END_GRACE_MINUTES * 60 * 1000);
    const result = await this.sessions().updateMany(
      { status: { $in: ['SCHEDULED', 'LIVE'] }, endTime: { $lt: cutoff } },
      { $set: { status: 'ENDED', actualEndedAt: new Date(), updatedAt: new Date() } },
    );
    if (result.modifiedCount > 0) {
      this.logger.log(`Auto-ended ${result.modifiedCount} stale session(s) past their end time + ${AUTO_END_GRACE_MINUTES}min grace`);
    }
  }

  /** Extends the generated window forward so it never runs dry — re-derives from each class's
   * own schedules[] rather than trying to extrapolate off existing rows. */
  @Cron(CronExpression.EVERY_WEEK)
  async extendGeneratedWindows(): Promise<void> {
    const classesWithSchedules = await this.classes().find({ 'schedules.0': { $exists: true }, status: { $in: ['PUBLISHED', 'ACTIVE'] } }).toArray();
    for (const classDoc of classesWithSchedules) {
      try {
        await this.generateFromSchedules(classDoc as LiveClassDocument);
      } catch (err) {
        // A real conflict here means something else got scheduled into what should have been
        // this recurring class's own slot — log and skip rather than crash the whole sweep.
        this.logger.warn(`Failed to extend session window for class ${classDoc._id}: ${(err as Error).message}`);
      }
    }
  }

  /** Every minute, finds sessions entering the 24h/1h/15min reminder windows that haven't
   * already had that tier sent — tracked as an array field on the session document so a
   * mid-run restart can't double-fire. Publishes both the per-session domain audit event AND
   * a real per-student notifyEnrolledStudents fan-out (Task 40), each session's class title
   * fetched once and reused across the whole fan-out rather than per-student. */
  @Cron(CronExpression.EVERY_MINUTE)
  async sendReminders(): Promise<void> {
    const now = Date.now();
    const tiers: { tier: ReminderTier; ms: number; label: string }[] = [
      { tier: '24h', ms: 24 * 60 * 60 * 1000, label: '24 hours' },
      { tier: '1h', ms: 60 * 60 * 1000, label: '1 hour' },
      { tier: '15min', ms: 15 * 60 * 1000, label: '15 minutes' },
    ];

    for (const { tier, ms, label } of tiers) {
      // A 1-minute-wide window around the exact target time — this cron runs every minute, so
      // one pass is guaranteed to catch each session exactly once per tier.
      const windowStart = new Date(now + ms - 60_000);
      const windowEnd = new Date(now + ms);
      const due = await this.sessions()
        .find({ status: 'SCHEDULED', startTime: { $gte: windowStart, $lt: windowEnd }, remindersSent: { $ne: tier } })
        .toArray();

      for (const session of due) {
        this.eventPublisher.publishSessionReminder({
          sessionId: session._id.toHexString(),
          classId: session.classId.toHexString(),
          tier,
          startTime: session.startTime,
        });
        await this.sessions().updateOne({ _id: session._id }, { $addToSet: { remindersSent: tier }, $set: { updatedAt: new Date() } });

        const classDoc = await this.classes().findOne({ _id: session.classId });
        if (classDoc) {
          void this.studentNotifier.notify(session.classId, classDoc.title, 'live-class-reminder', {
            reminderLabel: label,
            startTime: session.startTime,
          });
        }
      }
    }
  }
}
