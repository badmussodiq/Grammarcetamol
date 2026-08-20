'use client';

import {useEffect, useRef, useState} from 'react';
import {ApiError, Badge, Button, Skeleton, useToast} from '@grammarcetamol/utilities';
import {type ChatMessage, classesApi} from '@/lib/classes.api';
import {useClassChat} from '@/hooks/useClassChat';

const senderRoleLabel: Record<ChatMessage['senderRole'], string> = {
  instructor: 'Instructor',
  admin: 'Admin',
  student: 'Student',
};

export function ChatPanel({ classId, chatLocked }: { classId: string; chatLocked: boolean }) {
  const { addToast } = useToast();
  const { messages, loading } = useClassChat(classId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // jsdom (the test environment) doesn't implement Element.scrollTo — guard rather than crash.
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight });
  }, [messages?.length]);

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      // Deliberately not appending the response locally — the new message arrives back over
      // the socket (broadcast by ChatGateway right after the POST succeeds), same path every
      // other student sees it through. useClassChat's id-based dedup covers a slow/rare double
      // delivery; it never covers a message that never shows up at all.
      await classesApi.postMessage(classId, body);
      setDraft('');
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not send message' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface flex flex-col" style={{ height: 420 }}>
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {loading ? (
          <Skeleton variant="rect" height={60} />
        ) : messages && messages.length > 0 ? (
          messages.map((m) => <ChatBubble key={m.id} message={m} />)
        ) : (
          <p className="text-text-secondary text-sm text-center mt-8">No messages yet.</p>
        )}
      </div>
      <div className="border-t border-border p-3">
        {chatLocked ? (
          <p className="text-sm text-text-muted text-center py-1.5">
            🔒 Chat is locked by the instructor
          </p>
        ) : (
          <div className="flex gap-2">
            <textarea
              aria-label="Message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Ask a question..."
              rows={1}
              className="flex-1 resize-none rounded-md border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40 focus:border-primary"
            />
            <Button size="sm" loading={sending} disabled={!draft.trim()} onClick={handleSend}>Send</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isStaff = message.senderRole === 'instructor' || message.senderRole === 'admin';
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <Badge variant={isStaff ? 'info' : 'neutral'} size="sm">{senderRoleLabel[message.senderRole]}</Badge>
        <span className="text-xs text-text-muted">{new Date(message.createdAt).toLocaleTimeString(undefined, { timeStyle: 'short' })}</span>
      </div>
      <p className="text-sm text-text-primary whitespace-pre-line">{message.body}</p>
    </div>
  );
}
