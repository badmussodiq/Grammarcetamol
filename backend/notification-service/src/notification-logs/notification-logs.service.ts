import {Inject, Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import type {Collection, Db} from 'mongodb';
import {MONGO_DB} from '@/config/database.module';
import type {NotificationLog} from './notification-log.types';

@Injectable()
export class NotificationLogsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationLogsService.name);

  constructor(@Inject(MONGO_DB) private readonly db: Db) {}

  private collection(): Collection<NotificationLog> {
    return this.db.collection<NotificationLog>('notification_logs');
  }

  async onApplicationBootstrap(): Promise<void> {
    // Index on createdAt for the admin list view's default sort; on (service, status) for the
    // "failed sends by service" filter an admin dashboard will want. No unique index — every
    // send attempt is its own row, duplicates (e.g. a retried event) are expected and fine.
    await this.collection().createIndex({ createdAt: -1 });
    await this.collection().createIndex({ service: 1, status: 1 });
  }

  /** The only write path on this collection — no update/delete method exists anywhere in this
   * service, on purpose. Never throws: a failure to write the audit row must never take down
   * the consumer that's already mid-way through handling a real event. */
  async append(entry: Omit<NotificationLog, 'createdAt'>): Promise<void> {
    try {
      await this.collection().insertOne({ ...entry, createdAt: new Date() });
    } catch (err) {
      this.logger.error(`Failed to write notification_logs row: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async list(filter: { service?: string; status?: string } = {}, page = 1, limit = 20) {
    const query: Record<string, unknown> = {};
    if (filter.service) query.service = filter.service;
    if (filter.status) query.status = filter.status;

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
}
