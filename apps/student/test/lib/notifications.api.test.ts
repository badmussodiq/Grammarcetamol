import { describe, expect, it } from 'vitest';
import { buildNotificationsQuery } from '../../lib/notifications.api';

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
