'use client';

import Link from 'next/link';
import {Badge, Mapping, Skeleton, useFetch} from '@grammarcetamol/utilities';
import {useSessionLiveStatus} from '@/hooks/useSessionLiveStatus';
import type {MyClassRow} from '@/lib/classes.api';

function formatSessionTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function LiveClassesPanel() {
  const { data, loading } = useFetch<MyClassRow[]>('/api/classes/enrollments/mine');
  const withAccess = (data ?? []).filter((row) => row.enrollment.status === 'ACTIVE' || row.enrollment.status === 'PAUSED');

  if (!loading && withAccess.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text-primary">Live Classes</h2>
        <Link href="/live-classes?tab=mine" className="text-sm text-primary hover:underline">View All</Link>
      </div>
      {loading ? (
        <div className="flex gap-4 overflow-x-auto">
          {[0, 1].map((i) => <Skeleton key={i} variant="rect" height={120} width={280} />)}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-1">
          <Mapping array={withAccess} keyExtractor={(row) => row.enrollment.id}>
            {(row) => <LiveClassWidgetCard row={row} />}
          </Mapping>
        </div>
      )}
    </section>
  );
}

function LiveClassWidgetCard({ row }: { row: MyClassRow }) {
  const { state } = useSessionLiveStatus(row.class.id, row.nextSession);

  return (
    <Link
      href={`/live-classes/${row.class.id}`}
      className="flex-shrink-0 w-72 flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 hover:shadow-lg transition-shadow duration-200"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-text-primary line-clamp-1">{row.class.title}</p>
        {state === 'live' && <Badge variant="success" size="sm" dot>Live</Badge>}
      </div>
      <p className="text-sm text-text-secondary">
        {row.nextSession ? formatSessionTime(row.nextSession.startTime) : 'No upcoming session'}
      </p>
    </Link>
  );
}
