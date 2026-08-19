'use client';

import {useEffect, useState} from 'react';
import {ApiError} from '@grammarcetamol/utilities';
import {classesApi, type RoomInfo} from '@/lib/classes.api';

export type SessionLiveState = 'not-live' | 'live' | 'ended' | 'not-enrolled' | 'invite-not-accepted' | 'error';

/** The room-reveal endpoint's four denial reasons are all 403s, distinguished only by this
 * exact message text — the backend's shared exception filter doesn't serialize a machine-
 * readable `reason` field (see sessions.service.ts's RoomAccessDeniedException). These strings
 * must stay in sync with that class's own messageFor() switch. */
const DENIAL_MESSAGE_TO_STATE: Record<string, SessionLiveState> = {
  'This session has not started yet': 'not-live',
  'This session has already ended': 'ended',
  'You are not enrolled in this class': 'not-enrolled',
  'Access to this class requires an accepted invitation': 'invite-not-accepted',
};

export function classifyRoomError(message: string): SessionLiveState {
  return DENIAL_MESSAGE_TO_STATE[message] ?? 'error';
}

/** Once reached, polling stops for good — none of these resolve themselves by waiting longer. */
export function isTerminalSessionState(state: SessionLiveState): boolean {
  return state === 'ended' || state === 'not-enrolled' || state === 'invite-not-accepted';
}

/** Pure — how long to wait before the next poll, given how far away the session's scheduled
 * start is. A session hours away doesn't need checking every few seconds; one about to start
 * (or already live) does. */
export function nextPollDelayMs(msUntilStart: number): number {
  if (msUntilStart > 30 * 60_000) return 5 * 60_000;
  if (msUntilStart > 5 * 60_000) return 30_000;
  return 5_000;
}

/**
 * Polls the real room-reveal endpoint — never trusts a client-side countdown alone, since the
 * backend call is the actual access gate (PLAN.md Task 41's own explicit requirement). Shared
 * between the classroom's Join button and the dashboard's "live now" widget so the polling
 * logic exists exactly once.
 */
export function useSessionLiveStatus(
  classId: string | null,
  session: { id: string; startTime: string } | null | undefined,
): { state: SessionLiveState; room: RoomInfo | null } {
  const [state, setState] = useState<SessionLiveState>('not-live');
  const [room, setRoom] = useState<RoomInfo | null>(null);

  useEffect(() => {
    if (!classId || !session) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function check() {
      try {
        const { data } = await classesApi.getRoom(classId as string, (session as { id: string }).id);
        if (cancelled) return;
        setRoom(data);
        setState('live');
        return;
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : '';
        const next = classifyRoomError(message);
        setState(next);
        if (isTerminalSessionState(next)) return;
      }
      const delay = nextPollDelayMs(new Date((session as { startTime: string }).startTime).getTime() - Date.now());
      timer = setTimeout(check, delay);
    }

    void check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [classId, session?.id, session?.startTime]);

  return { state, room };
}
