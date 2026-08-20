'use client';

import {Suspense, useEffect, useState} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import Link from 'next/link';
import type {CalendarEvent, DataTableColumn} from '@grammarcetamol/utilities';
import {ApiError, Badge, Button, Calendar, DataTable, Skeleton, useFetch, useToast} from '@grammarcetamol/utilities';
import {
  type ClassFilters,
  classesApi,
  type ClassType,
  formatClassSchedule,
  formatClassPrice,
  type LiveClass,
} from '@/lib/classes.api';

type ViewMode = 'list' | 'calendar';

const statusVariant: Record<LiveClass['status'], 'success' | 'warning' | 'neutral' | 'info' | 'error'> = {
  DRAFT: 'neutral',
  PUBLISHED: 'info',
  ACTIVE: 'success',
  PAUSED: 'warning',
  ENDED: 'neutral',
  ARCHIVED: 'neutral',
};

export default function LiveClassesPage() {
  return (
    <Suspense>
      <LiveClassesShell />
    </Suspense>
  );
}

function LiveClassesShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  const view = (searchParams.get('view') as ViewMode) ?? 'list';
  const [classType, setClassType] = useState<ClassType | ''>('');
  const [search, setSearch] = useState('');

  const filters: ClassFilters = { classType: classType || undefined, search: search || undefined };
  const { data: classes, loading, error, refetch } = useFetch<LiveClass[]>(`/api/classes${buildQuery(filters)}`);

  function setView(next: ViewMode) {
    router.replace(`/live-classes?view=${next}`, { scroll: false });
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Live Classes</h1>
            <p className="text-text-secondary mt-1 text-sm">Schedule, manage, and moderate live classes.</p>
          </div>
          <Link href="/live-classes/create"><Button>+ Schedule Class</Button></Link>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setView('list')}
              className={view === 'list' ? 'px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-white' : 'px-3 py-1.5 rounded-md text-sm font-medium bg-surface border border-border text-text-secondary'}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setView('calendar')}
              className={view === 'calendar' ? 'px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-white' : 'px-3 py-1.5 rounded-md text-sm font-medium bg-surface border border-border text-text-secondary'}
            >
              Calendar
            </button>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search classes…"
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40"
            />
            <select
              value={classType}
              onChange={(e) => setClassType(e.target.value as ClassType | '')}
              className="rounded-md border border-border px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40"
            >
              <option value="">All types</option>
              <option value="GROUP">Group</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-surface rounded-lg border border-border p-8 text-center text-text-secondary">
            Couldn&apos;t load live classes — your session may have expired. Try refreshing the page.
          </div>
        )}

        {!error && loading && <Skeleton variant="rect" height={320} />}

        {!error && !loading && classes && (
          view === 'list' ? (
            <ClassesTable classes={classes} onChanged={refetch} />
          ) : (
            <ClassesCalendar classes={classes} onChanged={refetch} onError={(msg) => addToast({ type: 'error', message: msg })} />
          )
        )}
      </div>
    </div>
  );
}

function buildQuery(filters: ClassFilters): string {
  const params = new URLSearchParams();
  if (filters.classType) params.set('classType', filters.classType);
  if (filters.search) params.set('search', filters.search);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function ClassesTable({ classes, onChanged }: { classes: LiveClass[]; onChanged: () => void }) {
  const { addToast } = useToast();

  async function handlePublish(id: string) {
    try {
      await classesApi.publish(id);
      addToast({ type: 'success', message: 'Class published' });
      onChanged();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not publish' });
    }
  }

  const columns: DataTableColumn<LiveClass>[] = [
    { key: 'title', header: 'Title', cell: (c) => <Link href={`/live-classes/${c.id}`} className="text-accent hover:underline">{c.title}</Link> },
    { key: 'type', header: 'Type', cell: (c) => <Badge variant="neutral" size="sm">{c.classType}</Badge> },
    { key: 'schedule', header: 'Schedule', cell: (c) => formatClassSchedule(c.schedules) },
    { key: 'capacity', header: 'Capacity', cell: (c) => (c.capacity != null ? String(c.capacity) : 'Unlimited') },
    { key: 'price', header: 'Price', cell: (c) => formatClassPrice(c) },
    { key: 'status', header: 'Status', cell: (c) => <Badge variant={statusVariant[c.status]} size="sm">{c.status}</Badge> },
    {
      key: 'actions',
      header: 'Actions',
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Link href={`/live-classes/${c.id}`} className="text-accent hover:underline text-sm">Manage</Link>
          {c.status === 'DRAFT' && (
            <button type="button" onClick={() => handlePublish(c.id)} className="text-accent hover:underline text-sm">Publish</button>
          )}
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} data={classes} keyExtractor={(c) => c.id} emptyMessage="No live classes match these filters yet." />;
}

function ClassesCalendar({ classes, onChanged, onError }: { classes: LiveClass[]; onChanged: () => void; onError: (message: string) => void }) {
  const router = useRouter();
  const [events, setEvents] = useState<(CalendarEvent & { classId: string })[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const perClass = await Promise.all(
        classes.map(async (cls) => {
          try {
            const { data: sessions } = await classesApi.listSessions(cls.id);
            return sessions.map((s) => ({ id: s.id, classId: cls.id, title: cls.title, start: s.startTime, end: s.endTime, status: s.status }));
          } catch {
            return [];
          }
        }),
      );
      if (!cancelled) setEvents(perClass.flat());
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [classes]);

  async function handleEventChange(sessionId: string, start: Date, end: Date): Promise<boolean> {
    try {
      await classesApi.rescheduleSession(sessionId, start.toISOString(), end.toISOString());
      onChanged();
      return true;
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not reschedule — that slot conflicts with another session');
      return false;
    }
  }

  if (events === null) return <Skeleton variant="rect" height={480} />;

  return (
    <div className="bg-surface rounded-lg border border-border p-4">
      <Calendar
        events={events}
        onEventClick={(sessionId) => {
          const event = events.find((e) => e.id === sessionId);
          if (event) router.push(`/live-classes/${event.classId}?tab=sessions`);
        }}
        onEventChange={handleEventChange}
      />
    </div>
  );
}
