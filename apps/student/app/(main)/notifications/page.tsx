'use client';

import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {ApiError, Button, Mapping, Skeleton, useFetch, useToast} from '@grammarcetamol/utilities';
import {
    buildNotificationsQuery,
    type Notification,
    notificationsApi,
    type NotificationType,
    type Paged
} from '@/lib/notifications.api';
import {NotificationItem} from '@/components/NotificationItem';

const TYPE_FILTERS: { label: string; value: NotificationType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Course', value: 'course' },
  { label: 'Payment', value: 'payment' },
  { label: 'Announcement', value: 'announcement' },
  { label: 'System', value: 'system' },
];

export default function NotificationsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [type, setType] = useState<NotificationType | 'all'>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const query = buildNotificationsQuery({ type: type === 'all' ? undefined : type, unreadOnly, limit: 50 });
  const { data, loading, refetch } = useFetch<Paged<Notification>>(`/api/notifications${query}`);

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllRead();
      refetch();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to mark all as read' });
    }
  }

  async function handleItemClick(notification: Notification) {
    if (!notification.readAt) {
      try {
        await notificationsApi.markRead(notification._id);
        refetch();
      } catch {
        // Non-fatal — item just stays marked unread until the next refresh.
      }
    }
    if (notification.type === 'payment' && notification.relatedId) {
      router.push(`/transactions/${notification.relatedId}`);
    }
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
        ) : data && data.items.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Mapping array={data.items} keyExtractor={(n) => n._id}>
              {(n) => <NotificationItem notification={n} onClick={handleItemClick} />}
            </Mapping>
          </div>
        ) : (
          <p className="text-text-secondary text-sm text-center py-12">You&apos;re all caught up.</p>
        )}
      </div>
    </main>
  );
}
