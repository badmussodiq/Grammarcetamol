'use client';

import {useState} from 'react';
import {ApiError, Badge, Button, useToast} from '@grammarcetamol/utilities';
import {classesApi, formatClassPrice, formatClassSchedule, type LiveClass} from '@/lib/classes.api';

export function OverviewTab({ cls, onChanged }: { cls: LiveClass; onChanged: () => void }) {
  const { addToast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: string, fn: () => Promise<unknown>, successMessage: string) {
    setBusy(action);
    try {
      await fn();
      addToast({ type: 'success', message: successMessage });
      onChanged();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : `Could not ${action}` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 mt-6">
      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="neutral" size="sm">{cls.classType}</Badge>
          <Badge variant="neutral" size="sm">{cls.accessMode === 'OPEN' ? 'Open' : 'Invite-only'}</Badge>
          <Badge variant={cls.chatLocked ? 'warning' : 'success'} size="sm">{cls.chatLocked ? 'Chat locked' : 'Chat unlocked'}</Badge>
        </div>
        <p className="text-[#64748B]">{cls.description}</p>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-[#64748B]">Schedule</dt><dd className="text-[#0F172A]">{formatClassSchedule(cls.schedules)}</dd></div>
          <div><dt className="text-[#64748B]">Price</dt><dd className="text-[#0F172A]">{formatClassPrice(cls)}</dd></div>
          <div><dt className="text-[#64748B]">Capacity</dt><dd className="text-[#0F172A]">{cls.capacity ?? 'Unlimited'}</dd></div>
          <div><dt className="text-[#64748B]">Video Platform</dt><dd className="text-[#0F172A] capitalize">{cls.videoProvider}</dd></div>
          <div><dt className="text-[#64748B]">Materials Retention</dt><dd className="text-[#0F172A]">{cls.materialsRetentionDays} days</dd></div>
          <div><dt className="text-[#64748B]">Status</dt><dd className="text-[#0F172A]">{cls.status}</dd></div>
        </dl>
      </section>

      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-[#0F172A]">Actions</h2>
        <div className="flex flex-wrap gap-3">
          {cls.status === 'DRAFT' && (
            <Button loading={busy === 'publish'} onClick={() => run('publish', () => classesApi.publish(cls.id), 'Class published')}>
              Publish
            </Button>
          )}
          {(cls.status === 'ACTIVE' || cls.status === 'PAUSED' || cls.status === 'PUBLISHED') && (
            <Button
              variant="secondary"
              loading={busy === 'chat-lock'}
              onClick={() => run('update chat lock', () => classesApi.setChatLock(cls.id, !cls.chatLocked), cls.chatLocked ? 'Chat unlocked' : 'Chat locked')}
            >
              {cls.chatLocked ? 'Unlock Chat' : 'Lock Chat'}
            </Button>
          )}
          {(cls.status === 'ACTIVE' || cls.status === 'PAUSED') && (
            <Button
              variant="destructive"
              loading={busy === 'end'}
              onClick={() => {
                if (!confirm(`Mark "${cls.title}" as ended? Students keep access to materials for ${cls.materialsRetentionDays} more days, then the class is archived — nothing is deleted.`)) return;
                run('end', () => classesApi.end(cls.id), 'Class ended');
              }}
            >
              Mark Class Ended
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
