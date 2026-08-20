'use client';

import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Badge, cn} from '@grammarcetamol/utilities';
import {type Notification, notificationsApi, resolveNotificationRoute, subscribeToStream} from '@/lib/notifications.api';
import {NotificationItem} from '@/components/NotificationItem';

const RECENT_LIMIT = 5;
const POLL_FALLBACK_INTERVAL_MS = 20000;

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

/**
 * Bell icon + dropdown panel (PLAN.md Task 42: "latest 5, View All link, inline mark-read,
 * unread badge sourced from getUnreadCount()/the live stream"). Bespoke rather than built on
 * the shared `Dropdown` component — that one only renders a flat list of clickable labels, not
 * rich notification rows with their own click/mark-read behavior, same reasoning as Task 41's
 * VideoCallOverlay not reusing Modal.
 */
export function NotificationBell({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<Notification[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    try {
      const [{ data: countData }, { data: listData }] = await Promise.all([
        notificationsApi.unreadCount(),
        notificationsApi.list({ limit: RECENT_LIMIT }),
      ]);
      setUnreadCount(countData.count);
      setRecent(listData.items);
    } catch {
      // Non-fatal — the bell just keeps showing its last-known state until the next refresh.
    }
  }

  useEffect(() => {
    if (!enabled) return;
    void refresh();

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const unsubscribe = subscribeToStream(
      (notification) => {
        setUnreadCount((c) => c + 1);
        setRecent((prev) => [notification, ...(prev ?? [])].slice(0, RECENT_LIMIT));
      },
      () => {
        pollTimer = setInterval(refresh, POLL_FALLBACK_INTERVAL_MS);
      },
    );

    return () => {
      unsubscribe();
      if (pollTimer) clearInterval(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  async function handleItemClick(notification: Notification) {
    if (!notification.readAt) {
      setUnreadCount((c) => Math.max(0, c - 1));
      setRecent((prev) => (prev ?? []).map((n) => (n._id === notification._id ? { ...n, readAt: new Date().toISOString() } : n)));
      notificationsApi.markRead(notification._id).catch(() => {});
    }
    setOpen(false);
    router.push(resolveNotificationRoute(notification) ?? '/notifications');
  }

  if (!enabled) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-text-secondary hover:text-text-primary"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5">
            <Badge variant="error" size="sm" dot={false}>{unreadCount > 9 ? '9+' : unreadCount}</Badge>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-surface border border-border rounded-lg shadow-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="font-semibold text-text-primary text-sm">Notifications</p>
            <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs text-primary hover:underline">
              View All
            </Link>
          </div>
          <div className={cn('max-h-96 overflow-y-auto', recent && recent.length > 0 ? 'p-2 flex flex-col gap-1' : '')}>
            {recent === null ? (
              <p className="text-text-secondary text-sm text-center py-8">Loading…</p>
            ) : recent.length === 0 ? (
              <p className="text-text-secondary text-sm text-center py-8">No notifications yet.</p>
            ) : (
              recent.map((n) => <NotificationItem key={n._id} notification={n} onClick={handleItemClick} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
