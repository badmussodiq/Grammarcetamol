'use client';

import {Suspense, useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import {ApiError, Skeleton, useToast} from '@grammarcetamol/utilities';
import {AnnouncementForm} from '@/components/AnnouncementForm';
import {PublishConfirmModal} from '@/components/PublishConfirmModal';
import {
  type AnnouncementFormValues,
  announcementsApi,
  announcementToFormValues,
  EMPTY_ANNOUNCEMENT_FORM,
} from '@/lib/announcements.api';

export default function CreateAnnouncementPage() {
  return (
    <Suspense>
      <CreateAnnouncementShell />
    </Suspense>
  );
}

function CreateAnnouncementShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const duplicateId = searchParams.get('duplicate');

  const [initialValues, setInitialValues] = useState<AnnouncementFormValues | null>(duplicateId ? null : EMPTY_ANNOUNCEMENT_FORM);
  const [loadError, setLoadError] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; schedule: 'now' | 'later' } | null>(null);

  useEffect(() => {
    if (!duplicateId) return;
    announcementsApi.get(duplicateId)
      .then((res) => {
        // A fresh draft, not a copy of the original's schedule/expiry — "duplicate" means
        // reusing the content/targeting, not re-sending on the same timeline.
        const values = announcementToFormValues(res.data);
        setInitialValues({ ...values, schedule: 'draft', publishAt: '', expiresAt: '' });
      })
      .catch(() => setLoadError(true));
  }, [duplicateId]);

  async function handleSubmit(values: AnnouncementFormValues) {
    try {
      const res = await announcementsApi.create(values);
      if (values.schedule === 'draft') {
        addToast({ type: 'success', message: 'Saved as draft' });
        router.push(`/announcements/${res.data.id}`);
        return;
      }
      setConfirm({ id: res.data.id, schedule: values.schedule === 'later' ? 'later' : 'now' });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to create announcement' });
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/announcements" className="text-sm text-accent hover:underline">← Back to Announcements</Link>
        <h1 className="text-2xl font-bold text-[#0F172A] mt-3 mb-1">{duplicateId ? 'Duplicate Announcement' : 'New Announcement'}</h1>
        <p className="text-[#64748B] text-sm mb-6">
          {duplicateId ? 'Reusing this announcement\'s content and targeting as a new draft.' : 'Saved as a draft first — publishing (immediate or scheduled) is a separate, confirmed step.'}
        </p>

        {loadError && <p className="text-error text-sm">Couldn&apos;t load the announcement to duplicate.</p>}
        {!loadError && !initialValues && <Skeleton variant="rect" height={400} />}
        {!loadError && initialValues && (
          <AnnouncementForm initialValues={initialValues} onSubmit={handleSubmit} submitLabel="Save" />
        )}
      </div>

      {confirm && (
        <PublishConfirmModal
          open
          announcementId={confirm.id}
          schedule={confirm.schedule}
          onClose={() => router.push(`/announcements/${confirm.id}`)}
          onPublished={() => router.push(`/announcements/${confirm.id}`)}
        />
      )}
    </div>
  );
}
