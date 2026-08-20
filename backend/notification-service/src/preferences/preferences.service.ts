import {Inject, Injectable, OnApplicationBootstrap} from '@nestjs/common';
import type {Collection, Db} from 'mongodb';
import {MONGO_DB} from '@/config/database.module';
import type {NotificationType} from '@/notifications/notification.types';
import {ChannelPreference, DEFAULT_PREFERENCES, NotificationPreferences, PreferenceType} from './preference.types';

@Injectable()
export class PreferencesService implements OnApplicationBootstrap {
  constructor(@Inject(MONGO_DB) private readonly db: Db) {}

  private collection(): Collection<NotificationPreferences> {
    return this.db.collection<NotificationPreferences>('notification_preferences');
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.collection().createIndex({ userId: 1 }, { unique: true });
  }

  /** Everyone defaults to fully opted-in (opt-out model, not opt-in) — a user who never
   * touches this page keeps getting notified, matching what they'd expect before this feature
   * existed at all. */
  async getFor(userId: string): Promise<Record<PreferenceType, ChannelPreference>> {
    const doc = await this.collection().findOne({ userId });
    return doc?.preferences ?? DEFAULT_PREFERENCES;
  }

  async update(userId: string, preferences: Record<PreferenceType, ChannelPreference>): Promise<Record<PreferenceType, ChannelPreference>> {
    await this.collection().updateOne(
      { userId },
      { $set: { preferences, updatedAt: new Date() }, $setOnInsert: { userId } },
      { upsert: true },
    );
    return preferences;
  }

  /** The single check NotificationSenderService funnels through — `system`-type
   * notifications always pass (see preference.types.ts), everything else respects the
   * user's stored (or default) choice for that channel. */
  async isEnabled(userId: string, type: NotificationType, channel: 'inApp' | 'email'): Promise<boolean> {
    if (type === 'system') return true;
    const prefs = await this.getFor(userId);
    return prefs[type as PreferenceType]?.[channel] ?? true;
  }
}
