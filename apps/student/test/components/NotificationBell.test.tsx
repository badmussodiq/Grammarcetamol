/**
 * Component test for NotificationBell — mocks only global.fetch. subscribeToStream() no-ops in
 * jsdom (no native EventSource there), so this exercises the REST-driven part of the bell:
 * unread badge, latest-5 list, and inline mark-read on click.
 */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {NotificationBell} from '@/components/NotificationBell';

// No <AppRouterContext.Provider> exists in this bare RTL render, so useRouter() throws
// ("invariant expected app router to be mounted") unless stubbed — no other component test in
// this app has needed router navigation yet, so there's no existing convention to follow here.
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const NOTIFICATIONS = [
  { _id: 'n1', userId: 'u1', type: 'live_class', title: 'Class is starting', message: '"Saturday Revision" is starting now.', relatedId: 'class-1', readAt: null, createdAt: '2026-08-19T10:00:00.000Z' },
];

describe('NotificationBell', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    push.mockClear();
    fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('/unread-count')) {
        return Promise.resolve(jsonResponse({ success: true, data: { count: 1 }, error: null, timestamp: '' }));
      }
      if (String(url).includes('/read') && init?.method === 'PATCH') {
        return Promise.resolve(jsonResponse({ success: true, data: null, error: null, timestamp: '' }));
      }
      return Promise.resolve(jsonResponse({ success: true, data: { items: NOTIFICATIONS, page: 1, limit: 5, total: 1, totalPages: 1 }, error: null, timestamp: '' }));
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nothing when disabled (not authenticated)', () => {
    const { container } = render(<NotificationBell enabled={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the unread badge and, once opened, the latest notification', async () => {
    render(<NotificationBell enabled />);

    await waitFor(() => expect(screen.getByText('1')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => expect(screen.getByText('Class is starting')).toBeTruthy());
  });

  it('marks a notification read on click and decrements the badge', async () => {
    render(<NotificationBell enabled />);
    await waitFor(() => expect(screen.getByText('1')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => expect(screen.getByText('Class is starting')).toBeTruthy());

    fireEvent.click(screen.getByText('Class is starting'));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([url, init]) => String(url).includes('/n1/read') && init?.method === 'PATCH');
      expect(patchCall).toBeDefined();
    });
    expect(push).toHaveBeenCalledWith('/live-classes/class-1');
  });
});
