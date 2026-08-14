import {Inject, Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import type {Collection, Db} from 'mongodb';
import {MONGO_DB} from '../config/database.module';
import {TEMPLATE_SEEDS} from './templates.seed';
import type {EmailTemplate} from './template.types';

@Injectable()
export class TemplatesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(@Inject(MONGO_DB) private readonly db: Db) {}

  private collection(): Collection<EmailTemplate> {
    return this.db.collection<EmailTemplate>('notification_templates');
  }

  /** Runs on every boot, not just first-install — same "safe to re-run" spirit as this
   * project's SQL migration runners, just shaped for a schemaless store instead of a
   * migration file. Upserts by `name`: a template already present gets its subject/bodyHtml/
   * bodyText/variables refreshed from the seed (so editing templates.seed.ts and restarting
   * is how templates get updated for now, until an admin-editing UI exists), but `isActive`
   * is left untouched if the row already exists — an admin turning a template off shouldn't
   * get silently re-enabled by the next deploy. */
  async onApplicationBootstrap(): Promise<void> {
    const collection = this.collection();
    await collection.createIndex({ name: 1 }, { unique: true });

    for (const seed of TEMPLATE_SEEDS) {
      await collection.updateOne(
        { name: seed.name },
        {
          $set: {
            subject: seed.subject,
            bodyHtml: seed.bodyHtml,
            bodyText: seed.bodyText,
            variables: seed.variables,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            name: seed.name,
            isActive: true,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
    }
    this.logger.log(`Seeded ${TEMPLATE_SEEDS.length} email templates`);
  }

  async findByName(name: string): Promise<EmailTemplate | null> {
    return this.collection().findOne({ name });
  }

  async findAll(): Promise<EmailTemplate[]> {
    return this.collection().find().sort({ name: 1 }).toArray();
  }

  async setActive(name: string, isActive: boolean): Promise<EmailTemplate | null> {
    await this.collection().updateOne({ name }, { $set: { isActive, updatedAt: new Date() } });
    return this.findByName(name);
  }
}
