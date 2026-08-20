'use client';

import {useState} from 'react';
import {ApiError, Badge, Button, Mapping, useFetch, useToast} from '@grammarcetamol/utilities';
import {classesApi, type ChatMessage, type LiveClass} from '@/lib/classes.api';

export function ChatTab({ cls, onChanged }: { cls: LiveClass; onChanged: () => void }) {
  const { addToast } = useToast();
  const { data: messages, loading, refetch } = useFetch<ChatMessage[]>(`/api/classes/${cls.id}/messages`);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);

  async function handlePost() {
    if (!body.trim()) return;
    setPosting(true);
    try {
      await classesApi.postMessage(cls.id, body.trim());
      setBody('');
      refetch();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not post message' });
    } finally {
      setPosting(false);
    }
  }

  async function handleToggleLock() {
    setTogglingLock(true);
    try {
      await classesApi.setChatLock(cls.id, !cls.chatLocked);
      addToast({ type: 'success', message: cls.chatLocked ? 'Chat unlocked' : 'Chat locked' });
      onChanged();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not update chat lock' });
    } finally {
      setTogglingLock(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 mt-6">
      <section className="bg-surface rounded-lg border border-border p-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#64748B]">Chat status</span>
          <Badge variant={cls.chatLocked ? 'warning' : 'success'} size="sm">{cls.chatLocked ? 'Locked' : 'Unlocked'}</Badge>
        </div>
        <Button variant="secondary" size="sm" loading={togglingLock} onClick={handleToggleLock}>
          {cls.chatLocked ? 'Unlock Chat' : 'Lock Chat'}
        </Button>
      </section>

      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-[#0F172A]">Messages</h2>
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-[#64748B]">Loading…</p>
          ) : !messages || messages.length === 0 ? (
            <p className="text-sm text-[#64748B]">No messages yet.</p>
          ) : (
            <Mapping array={messages} keyExtractor={(m) => m.id}>
              {(m) => (
                <div className="flex flex-col gap-0.5 rounded-md border border-border px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                    <span className="capitalize font-medium text-[#0F172A]">{m.senderRole}</span>
                    <span>{new Date(m.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                  <p className="text-sm text-[#0F172A]">{m.body}</p>
                </div>
              )}
            </Mapping>
          )}
        </div>
        <div className="flex gap-3">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handlePost(); }}
            placeholder="Post as admin…"
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40"
          />
          <Button loading={posting} onClick={handlePost}>Send</Button>
        </div>
      </section>
    </div>
  );
}
