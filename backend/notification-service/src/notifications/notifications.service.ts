import {Inject, Injectable, Logger, NotFoundException, OnApplicationBootstrap} from '@nestjs/common';
import type {Collection, Db} from 'mongodb';
import {ObjectId} from 'mongodb';
import {MONGO_DB} from '../config/database.module';
import type {Notification} from './notification.types';

@Injectable()
export class NotificationsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@Inject(MONGO_DB) private readonly db: Db) {}

  private collection(): Collection<Notification> {
    return this.db.collection<Notification>('notifications');
  }

  async onApplicationBootstrap(): Promise<void> {
    // {userId, createdAt} for the list view's default sort scoped to one user;
    // {userId, readAt} for the unread-count query (readAt: null).
    await this.collection().createIndex({ userId: 1, createdAt: -1 });
    await this.collection().createIndex({ userId: 1, readAt: 1 });
  }

  /** Never throws — a failure to write the in-app notification must never take down the
   * consumer/sender that already sent (or attempted) the email, same philosophy as
   * NotificationLogsService.append. */
  async create(entry: Omit<Notification, '_id' | 'createdAt' | 'readAt'>): Promise<void> {
    try {
      await this.collection().insertOne({ ...entry, readAt: null, createdAt: new Date() });
    } catch (err) {
      this.logger.error(`Failed to write notification row: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async listForUser(userId: string, filter: { type?: string; unreadOnly?: boolean } = {}, page = 1, limit = 20) {
    const query: Record<string, unknown> = { userId };
    if (filter.type) query.type = filter.type;
    if (filter.unreadOnly) query.readAt = null;

    const collection = this.collection();
    const [items, total] = await Promise.all([
      collection
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      collection.countDocuments(query),
    ]);

    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async markRead(id: string, userId: string): Promise<void> {
    const result = await this.collection().updateOne(
      { _id: this.parseId(id), userId },
      { $set: { readAt: new Date() } },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException('Notification not found');
    }
  }

  async markAllRead(userId: string): Promise<void> {
    await this.collection().updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });
  }

  async remove(id: string, userId: string): Promise<void> {
    const result = await this.collection().deleteOne({ _id: this.parseId(id), userId });
    if (result.deletedCount === 0) {
      throw new NotFoundException('Notification not found');
    }
  }

  /** A malformed id (not a 24-char hex string) must read as "not found," not a 500 — ObjectId's
   * constructor throws BSONError on anything else. */
  private parseId(id: string): ObjectId {
    try {
      return new ObjectId(id);
    } catch {
      throw new NotFoundException('Notification not found');
    }
  }

  async unreadCount(userId: string): Promise<number> {
    return this.collection().countDocuments({ userId, readAt: null });
  }
}
