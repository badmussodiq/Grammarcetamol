'use client';

import {useState} from 'react';
import {ApiError, Badge, Button, useFetch, useToast} from '@grammarcetamol/utilities';
import {classesApi, type LiveSession} from '@/lib/classes.api';

const statusVariant: Record<LiveSession['status'], 'success' | 'info' | 'neutral' | 'error'> = {
  LIVE: 'success',
  SCHEDULED: 'info',
  ENDED: 'neutral',
  CANCELLED: 'error',
};

export function SessionsTab({ classId }: { classId: string }) {
  const { addToast } = useToast();
  const { data: sessions, loading, refetch } = useFetch<LiveSession[]>(`/api/classes/${classId}/sessions`);
  const [creating, setCreating] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreate() {
    if (!start || !end) {
      addToast({ type: 'error', message: 'Set both a start and end time' });
      return;
    }
    setCreating(true);
    try {
      await classesApi.createSession(classId, {
        startTime: new Date(start).toISOString(),
        endTime: new Date(end).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      addToast({ type: 'success', message: 'Session scheduled' });
      setStart('');
      setEnd('');
      refetch();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not schedule that session — check for a conflict' });
    } finally {
      setCreating(false);
    }
  }

  async function handleStart(id: string) {
    setBusyId(id);
    try {
      await classesApi.startSession(id);
      addToast({ type: 'success', message: 'Session started' });
      refetch();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not start session' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleEnd(id: string, isScheduled: boolean) {
    if (!confirm(isScheduled ? 'Cancel this scheduled session?' : 'End this live session now?')) return;
    setBusyId(id);
    try {
      await classesApi.endSession(id);
      addToast({ type: 'success', message: isScheduled ? 'Session cancelled' : 'Session ended' });
      refetch();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not update session' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 mt-6">
      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-[#0F172A]">Schedule a One-Off Session</h2>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[#0F172A]">Start</label>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[#0F172A]">End</label>
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40" />
          </div>
          <Button loading={creating} onClick={handleCreate}>Schedule</Button>
        </div>
      </section>

      <section className="bg-surface rounded-lg border border-border overflow-hidden">
        <h2 className="font-semibold text-[#0F172A] p-6 pb-0">Sessions</h2>
        {loading ? (
          <p className="p-6 text-sm text-[#64748B]">Loading…</p>
        ) : !sessions || sessions.length === 0 ? (
          <p className="p-6 text-sm text-[#64748B]">No sessions scheduled yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant[s.status]} size="sm">{s.status}</Badge>
                  <span className="text-sm text-[#0F172A]">
                    {new Date(s.startTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    {' – '}
                    {new Date(s.endTime).toLocaleTimeString(undefined, { timeStyle: 'short' })}
                  </span>
                </div>
                <div className="flex gap-3">
                  {s.status === 'SCHEDULED' && (
                    <Button size="sm" variant="secondary" loading={busyId === s.id} onClick={() => handleStart(s.id)}>Start</Button>
                  )}
                  {(s.status === 'SCHEDULED' || s.status === 'LIVE') && (
                    <Button size="sm" variant="destructive" loading={busyId === s.id} onClick={() => handleEnd(s.id, s.status === 'SCHEDULED')}>
                      {s.status === 'SCHEDULED' ? 'Cancel' : 'End'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
