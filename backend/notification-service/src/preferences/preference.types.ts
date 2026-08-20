import type {NotificationType} from '@/notifications/notification.types';

export interface ChannelPreference {
  inApp: boolean;
  email: boolean;
}

/** One document per user. `system` notifications (OTP, account-locked, password-reset) are
 * deliberately not preference-able — see NotificationSenderService, they always send
 * regardless of what's stored here, since disabling them would be a real way to lock a user
 * out of their own account recovery. */
export type PreferenceType = Exclude<NotificationType, 'system'>;

export interface NotificationPreferences {
  userId: string;
  preferences: Record<PreferenceType, ChannelPreference>;
  updatedAt: Date;
}

export const DEFAULT_PREFERENCES: Record<PreferenceType, ChannelPreference> = {
  course: { inApp: true, email: true },
  payment: { inApp: true, email: true },
  live_class: { inApp: true, email: true },
  announcement: { inApp: true, email: true },
};
