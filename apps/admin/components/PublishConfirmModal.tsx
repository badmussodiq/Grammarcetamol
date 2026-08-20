'use client';

import {useEffect, useState} from 'react';
import {ApiError, Button, Modal, useToast} from '@grammarcetamol/utilities';
import {announcementsApi} from '@/lib/announcements.api';

/** Shared by the create flow (Publish Now / Schedule for later) and the detail page's explicit
 * Publish button — both need the exact same "fetch the real recipient count, confirm, then call
 * the actually-irreversible publish()" step, so it's one component rather than two copies. */
export function PublishConfirmModal({
  open,
  announcementId,
  schedule,
  onClose,
  onPublished,
}: {
  open: boolean;
  announcementId: string;
  /** Just copy — the backend decides scheduled-vs-immediate itself from the announcement's own
   * stored publishAt when publish() is called. */
  schedule: 'now' | 'later';
  onClose: () => void;
  onPublished: () => void;
}) {
  const { addToast } = useToast();
  const [count, setCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingCount(true);
    setCount(null);
    announcementsApi.recipientCount(announcementId)
      .then((res) => setCount(res.data.count))
      .catch(() => setCount(null))
      .finally(() => setLoadingCount(false));
  }, [open, announcementId]);

  async function handleConfirm() {
    setPublishing(true);
    try {
      await announcementsApi.publish(announcementId);
      addToast({ type: 'success', message: schedule === 'later' ? 'Announcement scheduled' : 'Announcement published' });
      onPublished();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not publish' });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={schedule === 'later' ? 'Schedule Announcement' : 'Publish Announcement'} size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[#0F172A]">
          {loadingCount
            ? 'Estimating recipients…'
            : count === null
              ? "Couldn't estimate recipients — try again."
              : (
                <>
                  This will {schedule === 'later' ? 'be sent to' : 'go out now to'} an estimated{' '}
                  <strong>{count}</strong> recipient{count === 1 ? '' : 's'}. This can&apos;t be undone.
                </>
              )}
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={publishing}>Cancel</Button>
          <Button onClick={handleConfirm} loading={publishing} disabled={loadingCount || count === null}>
            {schedule === 'later' ? 'Confirm & Schedule' : 'Confirm & Publish'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
