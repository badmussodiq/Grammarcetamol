'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFetch, Skeleton, Mapping } from '@grammarcetamol/utilities';
import { notificationsApi, type Notification, type Paged } from '@/lib/notifications.api';
import { NotificationItem } from '@/components/NotificationItem';

export function NotificationsPanel() {
  const router = useRouter();
  const { data, loading } = useFetch<Paged<Notification>>('/api/notifications?limit=5');

  const handleClick = async (notification: Notification) => {
    if (!notification.readAt) {
      try {
        await notificationsApi.markRead(notification._id);
      } catch {
        // Non-fatal — the notifications page reflects the true state regardless.
      }
    }
    router.push('/notifications');
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text-primary">Notifications</h2>
        <Link href="/notifications" className="text-sm text-primary hover:underline">View All</Link>
      </div>
      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => <Skeleton key={i} variant="rect" height={64} />)}
        </div>
      ) : data && data.items.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Mapping array={data.items} keyExtractor={(n) => n._id}>
            {(n) => <NotificationItem notification={n} onClick={handleClick} />}
          </Mapping>
        </div>
      ) : (
        <p className="text-text-secondary text-sm">No notifications yet.</p>
      )}
    </section>
  );
}
