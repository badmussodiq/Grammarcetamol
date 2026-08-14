'use client';

import {useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {ApiError, Badge, Button, Skeleton, useFetch, useToast} from '@grammarcetamol/utilities';
import {type Review, reviewsApi} from '@/lib/reviews.api';

const statusVariant: Record<Review['status'], 'success' | 'warning' | 'neutral' | 'error' | 'info'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  flagged: 'info',
};

export default function ReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const { addToast } = useToast();
  const { data: review, loading, error, refetch } = useFetch<Review>(`/api/reviews/${params.id}`);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approved' | 'rejected' | 'flagged' | null>(null);

  async function handleModerate(status: 'approved' | 'rejected' | 'flagged') {
    setBusy(status);
    try {
      await reviewsApi.moderate(params.id, { status, note: note.trim() || undefined });
      addToast({ type: 'success', message: `Review ${status}.` });
      setNote('');
      refetch();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to moderate review' });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          <Skeleton variant="text" width="40%" height={28} />
          <Skeleton variant="rect" height={200} />
        </div>
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="min-h-screen bg-background p-8 text-center">
        <p className="text-[#64748B] mb-2">Couldn&apos;t load this review.</p>
        <Link href="/reviews" className="text-accent hover:underline">Back to Reviews</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div>
          <Link href="/reviews" className="text-sm text-accent hover:underline">← Back to Reviews</Link>
          <h1 className="text-2xl font-bold text-[#0F172A] mt-3">{review.title || 'Untitled review'}</h1>
        </div>

        <div className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant={statusVariant[review.status]}>{review.status}</Badge>
              <span className="text-sm text-[#64748B]">{review.rating} ★</span>
              {review.edited && <span className="text-xs text-[#64748B]">(edited)</span>}
            </div>
            <span className="text-sm text-[#64748B]">{new Date(review.createdAt).toLocaleString()}</span>
          </div>

          <p className="text-[#0F172A] whitespace-pre-line">{review.comment || '—'}</p>

          <dl className="grid grid-cols-2 gap-4 text-sm border-t border-border pt-4">
            <div><dt className="text-[#64748B]">Student</dt><dd className="text-[#0F172A] font-mono text-xs">{review.userId}</dd></div>
            <div><dt className="text-[#64748B]">Course</dt><dd className="text-[#0F172A] font-mono text-xs">{review.courseId}</dd></div>
            <div><dt className="text-[#64748B]">Helpful votes</dt><dd className="text-[#0F172A]">{review.helpfulCount}</dd></div>
            {review.moderatedAt && (
              <div><dt className="text-[#64748B]">Last moderated</dt><dd className="text-[#0F172A]">{new Date(review.moderatedAt).toLocaleString()}</dd></div>
            )}
            {review.moderationNote && (
              <div className="col-span-2"><dt className="text-[#64748B]">Moderation note</dt><dd className="text-[#0F172A]">{review.moderationNote}</dd></div>
            )}
          </dl>
        </div>

        <div className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-[#0F172A]">Moderate</h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional moderation note"
            rows={3}
            className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40"
          />
          <div className="flex gap-2">
            <Button size="sm" loading={busy === 'approved'} disabled={review.status === 'approved'} onClick={() => handleModerate('approved')}>Approve</Button>
            <Button size="sm" variant="secondary" loading={busy === 'flagged'} disabled={review.status === 'flagged'} onClick={() => handleModerate('flagged')}>Flag</Button>
            <Button size="sm" variant="destructive" loading={busy === 'rejected'} disabled={review.status === 'rejected'} onClick={() => handleModerate('rejected')}>Reject</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
