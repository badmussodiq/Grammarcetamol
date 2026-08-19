'use client';

import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import {ApiError, Button, Mapping, Skeleton, useToast} from '@grammarcetamol/utilities';
import {
    type Notification,
    notificationsApi,
    type NotificationType,
    resolveNotificationRoute,
    subscribeToStream
} from '@/lib/notifications.api';
import {NotificationItem} from '@/components/NotificationItem';

const PAGE_SIZE = 20;
const POLL_FALLBACK_INTERVAL_MS = 20000;

const TYPE_FILTERS: { label: string; value: NotificationType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Course', value: 'course' },
  { label: 'Payment', value: 'payment' },
  { label: 'Live Class', value: 'live_class' },
  { label: 'Announcement', value: 'announcement' },
  { label: 'System', value: 'system' },
];

export default function NotificationsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [type, setType] = useState<NotificationType | 'all'>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  async function load(targetPage: number, append: boolean) {
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const { data } = await notificationsApi.list({
        type: type === 'all' ? undefined : type,
        unreadOnly,
        page: targetPage,
        limit: PAGE_SIZE,
      });
      setItems((prev) => (append ? [...(prev ?? []), ...data.items] : data.items));
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch {
      // Non-fatal — the list just stays on its last-known state.
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }

  useEffect(() => {
    void load(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, unreadOnly]);

  // Live delivery — a new notification (matching the current filter) is prepended immediately
  // rather than waiting for the next manual refresh; falls back to re-polling page 1 if the SSE
  // connection can't be kept alive (repeated reconnect failures).
  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const unsubscribe = subscribeToStream(
      (notification) => {
        const matchesType = type === 'all' || notification.type === type;
        const matchesUnread = !unreadOnly || !notification.readAt;
        if (matchesType && matchesUnread) {
          setItems((prev) => [notification, ...(prev ?? [])]);
        }
      },
      () => {
        pollTimer = setInterval(() => void load(1, false), POLL_FALLBACK_INTERVAL_MS);
      },
    );
    return () => {
      unsubscribe();
      if (pollTimer) clearInterval(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, unreadOnly]);

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllRead();
      await load(1, false);
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to mark all as read' });
    }
  }

  async function handleItemClick(notification: Notification) {
    if (!notification.readAt) {
      setItems((prev) => (prev ?? []).map((n) => (n._id === notification._id ? { ...n, readAt: new Date().toISOString() } : n)));
      notificationsApi.markRead(notification._id).catch(() => {});
    }
    const route = resolveNotificationRoute(notification);
    if (route) router.push(route);
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-text-primary">Notifications</h1>
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>Mark all read</Button>
        </div>
        <p className="text-text-secondary mb-6">Stay up to date with your courses, payments, and account.</p>

        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setType(f.value)}
                className={
                  type === f.value
                    ? 'px-3 py-1.5 rounded-full text-sm font-medium bg-primary text-white'
                    : 'px-3 py-1.5 rounded-full text-sm font-medium bg-surface border border-border text-text-secondary hover:bg-background'
                }
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer ml-auto">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            Unread only
          </label>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rect" height={72} />)}
          </div>
        ) : items && items.length > 0 ? (
          <>
            <div className="flex flex-col gap-2">
              <Mapping array={items} keyExtractor={(n) => n._id}>
                {(n) => <NotificationItem notification={n} onClick={handleItemClick} />}
              </Mapping>
            </div>
            {page < totalPages && (
              <div className="flex justify-center mt-6">
                <Button variant="secondary" loading={loadingMore} onClick={() => load(page + 1, true)}>
                  Load more
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-text-secondary text-sm text-center py-12">You&apos;re all caught up.</p>
        )}
      </div>
    </main>
  );
}
