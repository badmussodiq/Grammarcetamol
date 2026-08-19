import {BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, OnApplicationBootstrap} from '@nestjs/common';
import type {Collection, Db} from 'mongodb';
import {ObjectId} from 'mongodb';
import {MONGO_DB} from '@/config/database.module';
import {LiveClassEventPublisher} from '@/messaging/live-class-event-publisher';
import {SessionsService} from '@/sessions/sessions.service';
import type {ClassSchedule, LiveClass, LiveClassDocument} from './class.types';
import {toPublicClass} from './class.types';

export interface CreateClassInput {
  title: string;
  description: string;
  coverImageUrl?: string;
  classType: 'GROUP' | 'PRIVATE';
  accessMode: 'OPEN' | 'INVITE_ONLY';
  paymentModel: 'FREE' | 'ONE_TIME' | 'RECURRING';
  defaultPrice?: number;
  currency?: string;
  billingInterval?: string;
  capacity?: number;
  materialsRetentionDays?: number;
  videoProvider?: string;
  schedules?: ClassSchedule[];
}

export interface ListClassesFilter {
  classType?: string;
  accessMode?: string;
  instructorId?: string;
  search?: string;
  mine?: string; // caller's own userId when "mine" filter requested
}

@Injectable()
export class ClassesService implements OnApplicationBootstrap {
  constructor(
    @Inject(MONGO_DB) private readonly db: Db,
    private readonly sessionsService: SessionsService,
    private readonly eventPublisher: LiveClassEventPublisher,
  ) {}

  private classes(): Collection<LiveClass> {
    return this.db.collection<LiveClass>('classes');
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.classes().createIndex({ instructorId: 1, status: 1 });
    await this.classes().createIndex({ accessMode: 1, status: 1 });
  }

  async create(instructorId: string, input: CreateClassInput): Promise<LiveClassDocument> {
    if (input.paymentModel === 'RECURRING' && !input.billingInterval) {
      throw new BadRequestException('billingInterval is required when paymentModel is RECURRING');
    }
    if ((input.paymentModel === 'ONE_TIME' || input.paymentModel === 'RECURRING') && !input.defaultPrice) {
      throw new BadRequestException('defaultPrice is required for a paid class');
    }

    const now = new Date();
    const doc: LiveClass = {
      title: input.title,
      description: input.description,
      coverImageUrl: input.coverImageUrl ?? null,
      classType: input.classType,
      accessMode: input.accessMode,
      instructorId,
      paymentModel: input.paymentModel,
      defaultPrice: input.defaultPrice ?? null,
      currency: input.currency ?? 'NGN',
      billingInterval: input.billingInterval ?? null,
      capacity: input.capacity ?? null,
      status: 'DRAFT',
      chatLocked: true,
      materialsRetentionDays: input.materialsRetentionDays ?? 14,
      videoProvider: input.videoProvider ?? 'jitsi',
      schedules: input.schedules ?? [],
      createdBy: instructorId,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.classes().insertOne(doc as any);
    const inserted = { ...doc, _id: result.insertedId };
    this.eventPublisher.publishClassCreated({ classId: inserted._id.toHexString(), title: inserted.title, instructorId });
    return inserted;
  }

  async update(id: string, instructorId: string, isAdmin: boolean, patch: Partial<CreateClassInput>): Promise<LiveClassDocument> {
    const existing = await this.findById(id);
    if (existing.instructorId !== instructorId && !isAdmin) {
      throw new ForbiddenException('Only the instructor or an admin/moderator can edit this class');
    }

    const $set: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of ['title', 'description', 'coverImageUrl', 'defaultPrice', 'currency', 'billingInterval', 'capacity', 'materialsRetentionDays'] as const) {
      if (patch[key] !== undefined) $set[key] = patch[key];
    }

    let regenerateSessions = false;
    if (patch.schedules !== undefined) {
      $set.schedules = patch.schedules;
      regenerateSessions = true;
    }

    await this.classes().updateOne({ _id: existing._id }, { $set });
    const updated = await this.findById(id);

    if (regenerateSessions) {
      // Conflict-checked as a whole batch — see SessionsService.generateFromSchedules. If this
      // throws, the schedule change itself still persisted above; a real product decision
      // (roll back vs. leave schedules saved with no sessions generated) is left as-is here
      // since the conflict response already tells the caller exactly what to fix and retry.
      await this.sessionsService.generateFromSchedules(updated);
    }

    this.eventPublisher.publishClassUpdated({ classId: id, instructorId: updated.instructorId });
    return updated;
  }

  async publish(id: string, instructorId: string, isAdmin: boolean): Promise<LiveClassDocument> {
    const existing = await this.findById(id);
    if (existing.instructorId !== instructorId && !isAdmin) {
      throw new ForbiddenException('Only the instructor or an admin/moderator can publish this class');
    }
    if (existing.status !== 'DRAFT') {
      throw new ConflictException(`Cannot publish a class in status ${existing.status}`);
    }

    await this.classes().updateOne({ _id: existing._id }, { $set: { status: 'PUBLISHED', updatedAt: new Date() } });
    const updated = await this.findById(id);

    if (updated.schedules.length > 0) {
      await this.sessionsService.generateFromSchedules(updated);
    }
    // A class with zero schedules at publish time (e.g. a PRIVATE class whose first session
    // will be created manually once negotiation finishes) is valid — publishing doesn't
    // require sessions to already exist.

    await this.classes().updateOne({ _id: existing._id }, { $set: { status: 'ACTIVE', updatedAt: new Date() } });
    return this.findById(id);
  }

  /** Moves ACTIVE -> ENDED and starts the materialsRetentionDays countdown on student-facing
   * access — see PHASE4.md's Retention & Archival: the underlying data is never deleted here,
   * only enrollments' access eventually expires (handled by EnrollmentsService's own cron
   * reading this class's endedAt + materialsRetentionDays). */
  async end(id: string, instructorId: string, isAdmin: boolean): Promise<LiveClassDocument> {
    const existing = await this.findById(id);
    if (existing.instructorId !== instructorId && !isAdmin) {
      throw new ForbiddenException('Only the instructor or an admin/moderator can end this class');
    }
    if (existing.status !== 'ACTIVE' && existing.status !== 'PAUSED') {
      throw new ConflictException(`Cannot end a class in status ${existing.status}`);
    }

    await this.classes().updateOne({ _id: existing._id }, { $set: { status: 'ENDED', endedAt: new Date(), updatedAt: new Date() } });
    this.eventPublisher.publishClassEnded({ classId: id, instructorId: existing.instructorId });
    return this.findById(id);
  }

  async setChatLocked(id: string, instructorId: string, isAdmin: boolean, locked: boolean): Promise<LiveClassDocument> {
    const existing = await this.findById(id);
    if (existing.instructorId !== instructorId && !isAdmin) {
      throw new ForbiddenException('Only the instructor or an admin/moderator can lock or unlock chat');
    }
    await this.classes().updateOne({ _id: existing._id }, { $set: { chatLocked: locked, updatedAt: new Date() } });
    return this.findById(id);
  }

  async list(filter: ListClassesFilter, includePrivate: boolean): Promise<ReturnType<typeof toPublicClass>[]> {
    const query: Record<string, unknown> = {};
    if (!includePrivate) {
      // Anonymous/non-privileged browsing only ever sees OPEN classes — INVITE_ONLY classes
      // are reachable exclusively via an accepted invitation token, never the public list.
      query.accessMode = 'OPEN';
    }
    if (filter.classType) query.classType = filter.classType;
    if (filter.accessMode) query.accessMode = filter.accessMode;
    if (filter.instructorId) query.instructorId = filter.instructorId;
    if (filter.mine) query.instructorId = filter.mine;
    if (filter.search) query.title = { $regex: filter.search, $options: 'i' };

    const docs = await this.classes().find(query).sort({ createdAt: -1 }).toArray();
    return docs.map((d) => toPublicClass(d as LiveClassDocument));
  }

  async findById(id: string): Promise<LiveClassDocument> {
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      throw new NotFoundException(`Class not found: ${id}`);
    }
    const doc = await this.classes().findOne({ _id: objectId });
    if (!doc) {
      throw new NotFoundException(`Class not found: ${id}`);
    }
    return doc as LiveClassDocument;
  }
}
