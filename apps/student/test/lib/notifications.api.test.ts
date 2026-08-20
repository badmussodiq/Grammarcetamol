import {describe, expect, it} from 'vitest';
import {buildNotificationsQuery, resolveNotificationRoute} from '@/lib/notifications.api';

describe('buildNotificationsQuery', () => {
  it('returns an empty string when no filters are set', () => {
    expect(buildNotificationsQuery({})).toBe('');
  });

  it('includes type when set', () => {
    expect(buildNotificationsQuery({ type: 'payment' })).toBe('?type=payment');
  });

  it('includes unreadOnly only when true', () => {
    expect(buildNotificationsQuery({ unreadOnly: true })).toBe('?unreadOnly=true');
    expect(buildNotificationsQuery({ unreadOnly: false })).toBe('');
  });

  it('combines multiple filters', () => {
    const qs = buildNotificationsQuery({ type: 'course', unreadOnly: true, page: 2, limit: 10 });
    expect(qs).toBe('?type=course&unreadOnly=true&page=2&limit=10');
  });
});

describe('resolveNotificationRoute', () => {
  it('deep-links a live_class notification into that class\'s classroom', () => {
    expect(resolveNotificationRoute({ type: 'live_class', relatedId: 'class-1' })).toBe('/live-classes/class-1');
  });

  it('deep-links a payment notification into its transaction detail', () => {
    expect(resolveNotificationRoute({ type: 'payment', relatedId: 'payment-1' })).toBe('/transactions/payment-1');
  });

  it('has no route for a live_class/payment notification with no relatedId (e.g. sent before this field existed)', () => {
    expect(resolveNotificationRoute({ type: 'live_class', relatedId: null })).toBeNull();
    expect(resolveNotificationRoute({ type: 'payment', relatedId: null })).toBeNull();
  });

  it('has no route for course/announcement/system notifications, even with a relatedId', () => {
    expect(resolveNotificationRoute({ type: 'course', relatedId: 'course-1' })).toBeNull();
    expect(resolveNotificationRoute({ type: 'announcement', relatedId: 'ann-1' })).toBeNull();
    expect(resolveNotificationRoute({ type: 'system', relatedId: null })).toBeNull();
  });
});
