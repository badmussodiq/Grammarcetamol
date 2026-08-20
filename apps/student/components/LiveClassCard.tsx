'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {ApiError, Badge, Button, useToast} from '@grammarcetamol/utilities';
import {
  classesApi,
  type ClassCardAction,
  type Enrollment,
  formatCapacity,
  formatClassPrice,
  formatScheduleSummary,
  type LiveClass,
  resolveClassCardAction,
} from '@/lib/classes.api';

const classTypeLabel: Record<LiveClass['classType'], string> = {
  GROUP: 'Group',
  PRIVATE: 'Private',
};

const actionLabel: Record<ClassCardAction, string> = {
  'enroll-free': 'Enroll for Free',
  buy: 'Buy',
  subscribe: 'Subscribe',
  'enter-classroom': 'Enter Classroom',
  'payment-pending': 'Payment Pending',
  ended: 'Ended',
};

export function LiveClassCard({
  cls,
  enrollment,
  isStudent,
  onEnrolled,
}: {
  cls: LiveClass;
  enrollment: Enrollment | undefined;
  isStudent: boolean;
  onEnrolled?: () => void;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);
  const action = resolveClassCardAction(cls, enrollment);

  async function handleAction() {
    if (action === 'enter-classroom') {
      router.push(`/live-classes/${cls.id}`);
      return;
    }
    if (action === 'ended' || action === 'payment-pending') return;

    setBusy(true);
    try {
      const { data } = await classesApi.enrollInClass(cls.id);
      if (data.authorizationUrl) {
        // ONE_TIME/RECURRING: Paystack's hosted checkout page, not the inline popup — the
        // enroll endpoint only ever returns a redirect URL, no publicKey/amount for a popup.
        window.location.href = data.authorizationUrl;
        return;
      }
      addToast({ type: 'success', message: `You're enrolled in ${cls.title}!` });
      onEnrolled?.();
      router.push(`/live-classes/${cls.id}`);
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not enroll — try again' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface overflow-hidden hover:shadow-lg transition-shadow duration-200">
      <div className="aspect-video bg-background flex items-center justify-center overflow-hidden">
        {cls.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cls.coverImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-text-muted text-sm">No cover image</span>
        )}
      </div>
      <div className="flex flex-col gap-2 p-4 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="neutral" size="sm">{classTypeLabel[cls.classType]}</Badge>
          {cls.classType === 'GROUP' && <span className="text-xs text-text-secondary">{formatCapacity(cls.capacity)}</span>}
        </div>
        {action === 'enter-classroom' ? (
          <Link href={`/live-classes/${cls.id}`} className="font-semibold text-text-primary leading-snug line-clamp-2 hover:underline">
            {cls.title}
          </Link>
        ) : (
          <h3 className="font-semibold text-text-primary leading-snug line-clamp-2">{cls.title}</h3>
        )}
        <p className="text-sm text-text-secondary line-clamp-2">{cls.description}</p>
        <p className="text-xs text-text-muted">{formatScheduleSummary(cls.schedules)}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <span className="font-semibold text-text-primary">{formatClassPrice(cls)}</span>
          {!isStudent && action !== 'ended' ? (
            <Link href={`/login?returnUrl=/live-classes`}>
              <Button size="sm">{actionLabel[action]}</Button>
            </Link>
          ) : (
            <Button
              size="sm"
              variant={action === 'payment-pending' || action === 'ended' ? 'secondary' : 'primary'}
              disabled={action === 'ended' || action === 'payment-pending'}
              loading={busy}
              onClick={handleAction}
            >
              {actionLabel[action]}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
