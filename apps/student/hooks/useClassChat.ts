'use client';

import {useEffect, useState} from 'react';
import {io} from 'socket.io-client';
import {type ChatMessage, classesApi} from '@/lib/classes.api';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9000';

/**
 * Real-time class chat — added per explicit user direction (2026-08-19): chat uses sockets,
 * not polling. Message history still loads once via the existing REST endpoint (no backend
 * pagination exists either way — see classes.api.ts's own note on that); new messages arrive
 * live over Socket.IO, broadcast by ChatGateway right after a successful POST. The dedup-by-id
 * guard exists because the sender's own POST response and the socket echo of that same message
 * can both arrive — without it, a student would see their own message appear twice.
 */
export function useClassChat(classId: string): { messages: ChatMessage[] | null; loading: boolean } {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const { data } = await classesApi.listMessages(classId);
        if (!cancelled) setMessages(data);
      } catch {
        // Non-fatal — the socket can still deliver new messages even if history failed to load.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadHistory();

    const socket = io(SOCKET_URL, { path: '/socket.io/', withCredentials: true, transports: ['websocket'] });

    socket.on('connect', () => socket.emit('join-class', { classId }));
    socket.on('chat-message', (message: ChatMessage) => {
      if (cancelled) return;
      setMessages((prev) => {
        const list = prev ?? [];
        if (list.some((m) => m.id === message.id)) return list;
        return [...list, message];
      });
    });

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [classId]);

  return { messages, loading };
}
