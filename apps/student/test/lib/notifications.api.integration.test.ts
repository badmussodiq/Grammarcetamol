/**
 * Integration test for notificationsApi — exercises the real apiFetch/fetch wiring (only
 * global.fetch is mocked), matching reviews.api.integration.test.ts's pattern.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { notificationsApi } from '../../lib/notifications.api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('notificationsApi (integration — real fetch wiring, mocked network)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('list — GETs /api/notifications with query params', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { items: [], page: 1, limit: 20, total: 0, totalPages: 0 }, error: null, timestamp: '' }),
    );

    await notificationsApi.list({ unreadOnly: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:9000/api/notifications?unreadOnly=true');
    expect(init?.method ?? 'GET').toBe('GET');
  });

  it('markRead — PATCHes /api/notifications/{id}/read', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: null, error: null, timestamp: '' }));

    await notificationsApi.markRead('notif-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:9000/api/notifications/notif-1/read');
    expect(init.method).toBe('PATCH');
  });

  it('markAllRead — PATCHes /api/notifications/read-all', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: null, error: null, timestamp: '' }));

    await notificationsApi.markAllRead();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:9000/api/notifications/read-all');
    expect(init.method).toBe('PATCH');
  });

  it('unreadCount — GETs /api/notifications/unread-count', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { count: 3 }, error: null, timestamp: '' }));

    const result = await notificationsApi.unreadCount();

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:9000/api/notifications/unread-count');
    expect(result.data.count).toBe(3);
  });
});
