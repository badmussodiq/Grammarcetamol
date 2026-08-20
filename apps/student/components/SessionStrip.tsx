'use client';

import {Badge, Button} from '@grammarcetamol/utilities';
import type {MyClassRow} from '@/lib/classes.api';
import type {useSessionLiveStatus} from '@/hooks/useSessionLiveStatus';

function formatSessionTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function SessionStrip({
  nextSession,
  liveState,
  onJoin,
}: {
  nextSession: MyClassRow['nextSession'];
  liveState: ReturnType<typeof useSessionLiveStatus>['state'];
  onJoin: () => void;
}) {
  if (!nextSession) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
        No upcoming sessions scheduled right now.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-text-secondary">
          {nextSession.status === 'LIVE' ? 'Session in progress' : 'Next session'}
        </p>
        <p className="font-semibold text-text-primary">{formatSessionTime(nextSession.startTime)}</p>
      </div>
      <div className="flex items-center gap-3">
        {liveState === 'live' && <Badge variant="success" dot>Live now</Badge>}
        <Button disabled={liveState !== 'live'} onClick={onJoin}>
          {liveState === 'live' ? 'Join Live Class' : 'Not Live Yet'}
        </Button>
      </div>
    </div>
  );
}
