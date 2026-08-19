import {BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException, OnApplicationBootstrap} from '@nestjs/common';
import {Cron, CronExpression} from '@nestjs/schedule';
import type {Collection, Db} from 'mongodb';
import {ObjectId} from 'mongodb';
import {MONGO_DB} from '@/config/database.module';
import {AuthServiceClient, InternalUser} from '@/clients/auth-service.client';
import {EnrollmentServiceClient} from '@/clients/enrollment-service.client';
import {NotificationSenderService} from '@/sender/notification-sender.service';
import {NotificationsService} from '@/notifications/notifications.service';
import type {Announcement, AnnouncementDocument} from './announcement.types';

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  targetType: 'all' | 'courses' | 'segments';
  targetIds?: string[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  publishAt?: string;
  expiresAt?: string;
}

@Injectable()
export class AnnouncementsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    @Inject(MONGO_DB) private readonly db: Db,
    private readonly authServiceClient: AuthServiceClient,
    private readonly enrollmentServiceClient: EnrollmentServiceClient,
    private readonly notifications: NotificationsService,
    private readonly sender: NotificationSenderService,
  ) {}

  private collection(): Collection<Announcement> {
    return this.db.collection<Announcement>('announcements');
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.collection().createIndex({ status: 1, publishAt: 1 });
    await this.collection().createIndex({ status: 1, expiresAt: 1 });
  }

  async create(createdBy: string, input: CreateAnnouncementInput): Promise<AnnouncementDocument> {
    const now = new Date();
    const doc: Announcement = {
      title: input.title,
      body: input.body,
      targetType: input.targetType,
      targetIds: input.targetIds ?? [],
      priority: input.priority,
      status: 'draft',
      publishAt: input.publishAt ? new Date(input.publishAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      createdBy,
      publishedAt: null,
      recipientCount: null,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.collection().insertOne(doc as any);
    return { ...doc, _id: result.insertedId };
  }

  async update(id: string, patch: Partial<CreateAnnouncementInput>): Promise<AnnouncementDocument> {
    const existing = await this.findById(id);
    if (existing.status !== 'draft') {
      throw new ConflictException("Only a draft announcement's targeting/content can be edited — a published announcement's targeting can't change after the fact");
    }
    const $set: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of ['title', 'body', 'targetType', 'targetIds', 'priority'] as const) {
      if (patch[key] !== undefined) $set[key] = patch[key];
    }
    if (patch.publishAt !== undefined) $set.publishAt = patch.publishAt ? new Date(patch.publishAt) : null;
    if (patch.expiresAt !== undefined) $set.expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : null;

    await this.collection().updateOne({ _id: existing._id }, { $set });
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.collection().deleteOne({ _id: new ObjectId(id) });
  }

  async list(filter: { status?: string } = {}, page = 1, limit = 20) {
    const query: Record<string, unknown> = {};
    if (filter.status) query.status = filter.status;
    const collection = this.collection();
    const [items, total] = await Promise.all([
      collection.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      collection.countDocuments(query),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<AnnouncementDocument> {
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      throw new NotFoundException(`Announcement not found: ${id}`);
    }
    const doc = await this.collection().findOne({ _id: objectId });
    if (!doc) throw new NotFoundException(`Announcement not found: ${id}`);
    return doc as AnnouncementDocument;
  }

  /** Resolves the real recipient list for an announcement's current targeting. 'segments' is a
   * documented no-op (see announcement.types.ts) — always resolves to an empty list, never a
   * thrown error, so a segments-targeted announcement can still be created/previewed/published
   * without special-casing it at every call site. */
  private async resolveRecipients(announcement: Pick<Announcement, 'targetType' | 'targetIds'>): Promise<InternalUser[]> {
    if (announcement.targetType === 'all') {
      return this.authServiceClient.listActiveStudents();
    }
    if (announcement.targetType === 'courses') {
      const userIds = await this.enrollmentServiceClient.getEnrolledUserIds(announcement.targetIds);
      const users = await Promise.all(userIds.map((id) => this.authServiceClient.getUser(id)));
      return users.filter((u): u is InternalUser => u !== null);
    }
    return []; // segments — documented no-op
  }

  async recipientCount(id: string): Promise<number> {
    const announcement = await this.findById(id);
    const recipients = await this.resolveRecipients(announcement);
    return recipients.length;
  }

  /** Draft -> Scheduled (if publishAt is still in the future) or Draft -> Published
   * (immediately) otherwise. The actual fan-out only ever happens in doPublish, called either
   * right here (immediate case) or later by the cron sweep (scheduled case) — one code path,
   * not two. */
  async publish(id: string): Promise<AnnouncementDocument> {
    const announcement = await this.findById(id);
    if (announcement.status !== 'draft') {
      throw new ConflictException(`Cannot publish an announcement in status ${announcement.status}`);
    }
    if (announcement.publishAt && announcement.publishAt > new Date()) {
      await this.collection().updateOne({ _id: announcement._id }, { $set: { status: 'scheduled', updatedAt: new Date() } });
      return this.findById(id);
    }
    await this.doPublish(announcement);
    return this.findById(id);
  }

  private async doPublish(announcement: AnnouncementDocument): Promise<void> {
    const recipients = await this.resolveRecipients(announcement);
    const highPriority = announcement.priority === 'high' || announcement.priority === 'critical';

    for (const recipient of recipients) {
      if (highPriority) {
        // Routes through the same pipeline as every other notification — writes the in-app
        // row AND sends+logs the email, respecting the recipient's own announcement
        // preference (NotificationSenderService.send already gates on both).
        await this.sender.send({
          service: 'notification-service',
          templateName: 'announcement',
          to: recipient.email,
          toName: recipient.fullName ?? recipient.email,
          variables: { fullName: recipient.fullName ?? recipient.email, title: announcement.title, body: announcement.body },
          userId: recipient.id,
        });
      } else {
        // low/normal priority: in-app only, no email — still respects the in-app preference.
        void this.notifications.create({
          userId: recipient.id,
          type: 'announcement',
          title: announcement.title,
          message: announcement.body.slice(0, 150),
          relatedId: announcement._id.toHexString(),
        });
      }
    }

    await this.collection().updateOne(
      { _id: announcement._id },
      { $set: { status: 'published', publishedAt: new Date(), recipientCount: recipients.length, updatedAt: new Date() } },
    );
    this.logger.log(`Announcement ${announcement._id} published to ${recipients.length} recipient(s)`);
  }

  /** Sends exactly one real test send to the calling admin's own email, via the same template,
   * regardless of priority — doesn't touch status, doesn't count toward recipientCount, and
   * critically doesn't fan out to anyone else. */
  async sendTest(id: string, callerId: string): Promise<void> {
    const announcement = await this.findById(id);
    const caller = await this.authServiceClient.getUser(callerId);
    if (!caller) {
      throw new BadRequestException('Could not resolve your own account to send a test to');
    }
    await this.sender.send({
      service: 'notification-service',
      templateName: 'announcement',
      to: caller.email,
      toName: caller.fullName ?? caller.email,
      variables: { fullName: caller.fullName ?? caller.email, title: `[TEST] ${announcement.title}`, body: announcement.body },
    });
  }

  /** Already-published guard is inherent to the query itself (status: 'scheduled' only) —
   * publishing flips status to 'published', so a re-run of this same query naturally never
   * re-matches it. Runs every minute — cheap query, and the whole point of "scheduled" is a
   * specific publishAt time, not a coarser window. */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweepScheduled(): Promise<void> {
    const due = await this.collection().find({ status: 'scheduled', publishAt: { $lte: new Date() } }).toArray();
    for (const announcement of due) {
      try {
        await this.doPublish(announcement as AnnouncementDocument);
      } catch (err) {
        this.logger.error(`Failed to auto-publish announcement ${announcement._id}: ${(err as Error).message}`);
      }
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepExpired(): Promise<void> {
    const result = await this.collection().updateMany(
      { status: 'published', expiresAt: { $lte: new Date() } },
      { $set: { status: 'expired', updatedAt: new Date() } },
    );
    if (result.modifiedCount > 0) {
      this.logger.log(`Expired ${result.modifiedCount} announcement(s)`);
    }
  }
}
