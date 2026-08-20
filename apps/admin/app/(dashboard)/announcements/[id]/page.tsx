'use client';

import {useState} from 'react';
import {useParams, useRouter} from 'next/navigation';
import Link from 'next/link';
import {ApiError, Badge, Button, Skeleton, useFetch, useToast} from '@grammarcetamol/utilities';
import {AnnouncementForm} from '@/components/AnnouncementForm';
import {PublishConfirmModal} from '@/components/PublishConfirmModal';
import {
  type Announcement,
  type AnnouncementFormValues,
  announcementsApi,
  announcementToFormValues,
  PRIORITY_BADGE_VARIANT,
  STATUS_BADGE_VARIANT,
} from '@/lib/announcements.api';

export default function AnnouncementDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const { data: announcement, loading, error, refetch } = useFetch<Announcement>(`/api/announcements/${params.id}`);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleSave(values: AnnouncementFormValues) {
    try {
      await announcementsApi.update(params.id, values);
      addToast({ type: 'success', message: 'Saved' });
      refetch();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not save changes' });
    }
  }

  async function handleSendTest() {
    setBusy('test');
    try {
      await announcementsApi.sendTest(params.id);
      addToast({ type: 'success', message: 'Test sent to your own email' });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not send test' });
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!announcement || !confirm(`Delete "${announcement.title}"? This can't be undone.`)) return;
    setBusy('delete');
    try {
      await announcementsApi.remove(params.id);
      addToast({ type: 'success', message: 'Announcement deleted' });
      router.push('/announcements');
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not delete' });
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          <Skeleton variant="text" width="40%" height={28} />
          <Skeleton variant="rect" height={400} />
        </div>
      </div>
    );
  }

  if (error || !announcement) {
    return (
      <div className="min-h-screen bg-background p-8 text-center">
        <p className="text-[#64748B] mb-2">Couldn&apos;t load this announcement.</p>
        <Link href="/announcements" className="text-accent hover:underline">Back to Announcements</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div>
          <Link href="/announcements" className="text-sm text-accent hover:underline">← Back to Announcements</Link>
          <div className="flex items-center gap-3 mt-3">
            <h1 className="text-2xl font-bold text-[#0F172A]">{announcement.title}</h1>
            <Badge variant={STATUS_BADGE_VARIANT[announcement.status]} size="sm">{announcement.status}</Badge>
            <Badge variant={PRIORITY_BADGE_VARIANT[announcement.priority]} size="sm">{announcement.priority}</Badge>
          </div>
          {announcement.publishedAt && announcement.recipientCount != null && (
            <p className="text-sm text-[#64748B] mt-1">
              Sent to {announcement.recipientCount} recipient{announcement.recipientCount === 1 ? '' : 's'} on{' '}
              {new Date(announcement.publishedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {announcement.status === 'draft' && (
            <Button onClick={() => setShowPublishModal(true)}>{announcement.publishAt ? 'Schedule' : 'Publish'}</Button>
          )}
          <Button variant="secondary" loading={busy === 'test'} onClick={handleSendTest}>Send Test</Button>
          <Link href={`/announcements/create?duplicate=${announcement.id}`}>
            <Button variant="secondary">Duplicate</Button>
          </Link>
          <Button variant="destructive" loading={busy === 'delete'} onClick={handleDelete}>Delete</Button>
        </div>

        <AnnouncementForm
          initialValues={announcementToFormValues(announcement)}
          onSubmit={handleSave}
          submitLabel="Save Changes"
          status={announcement.status}
        />
      </div>

      <PublishConfirmModal
        open={showPublishModal}
        announcementId={announcement.id}
        schedule={announcement.publishAt ? 'later' : 'now'}
        onClose={() => setShowPublishModal(false)}
        onPublished={() => {
          setShowPublishModal(false);
          refetch();
        }}
      />
    </div>
  );
}
