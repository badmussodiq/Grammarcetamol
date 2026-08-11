import { cn } from '@grammarcetamol/utilities';
import type { Notification, NotificationType } from '@/lib/notifications.api';

const TYPE_STYLES: Record<NotificationType, string> = {
  course: 'bg-[#DBEAFE] text-[#1D4ED8]',
  payment: 'bg-[#D1FAE5] text-[#065F46]',
  live_class: 'bg-[#EDE9FE] text-[#6D28D9]',
  announcement: 'bg-[#FEF3C7] text-[#92400E]',
  system: 'bg-[#F1F5F9] text-[#475569]',
};

const TYPE_LABELS: Record<NotificationType, string> = {
  course: 'Course',
  payment: 'Payment',
  live_class: 'Live Class',
  announcement: 'Announcement',
  system: 'System',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationItem({ notification, onClick }: { notification: Notification; onClick?: (n: Notification) => void }) {
  const isUnread = !notification.readAt;

  return (
    <button
      type="button"
      onClick={() => onClick?.(notification)}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 text-left rounded-lg border border-border transition-colors',
        isUnread ? 'bg-primary/5' : 'bg-surface',
        'hover:bg-background',
      )}
    >
      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0', TYPE_STYLES[notification.type])}>
        {TYPE_LABELS[notification.type]}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-text-primary truncate">{notification.title}</span>
        <span className="block text-sm text-text-secondary line-clamp-2">{notification.message}</span>
        <span className="block text-xs text-text-muted mt-1">{timeAgo(notification.createdAt)}</span>
      </span>
      {isUnread && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" aria-label="Unread" />}
    </button>
  );
}
