'use client';

import {Suspense, useMemo, useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {Input, Skeleton, Tabs, useFetch} from '@grammarcetamol/utilities';
import {useAuth} from '@/contexts/AuthContext';
import {LiveClassCard} from '@/components/LiveClassCard';
import {buildClassQuery, type ClassType, type LiveClass, type MyClassRow} from '@/lib/classes.api';

type BrowseTab = 'upcoming' | 'past' | 'mine';

const TABS = [
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Past', value: 'past' },
  { label: 'Mine', value: 'mine' },
];

const CLASS_TYPES: { value: ClassType | null; label: string }[] = [
  { value: null, label: 'All types' },
  { value: 'GROUP', label: 'Group' },
  { value: 'PRIVATE', label: 'Private' },
];

// A class's own lifecycle status stands in for "upcoming vs. past" — the classes list endpoint
// has no session-date filtering, only class status (DRAFT/PUBLISHED/ACTIVE/PAUSED/ENDED/
// ARCHIVED), so "Upcoming" means the class can still have sessions ahead of it.
const UPCOMING_STATUSES = new Set<LiveClass['status']>(['PUBLISHED', 'ACTIVE', 'PAUSED']);

export default function LiveClassesPage() {
  return (
    <Suspense>
      <LiveClassesBrowser />
    </Suspense>
  );
}

function LiveClassesBrowser() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const isStudent = !!user?.roles?.includes('STUDENT');
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<BrowseTab>(initialTab === 'mine' || initialTab === 'past' ? initialTab : 'upcoming');
  const [classType, setClassType] = useState<ClassType | null>(null);
  const [searchInput, setSearchInput] = useState('');

  const qs = buildClassQuery({ classType: classType ?? undefined, search: searchInput || undefined });
  const { data: classes, loading: classesLoading, error, refetch } = useFetch<LiveClass[]>(
    tab === 'mine' ? null : `/api/classes${qs ? `?${qs}` : ''}`,
  );
  const { data: myClasses, loading: myClassesLoading, refetch: refetchMine } = useFetch<MyClassRow[]>(
    isStudent ? '/api/classes/enrollments/mine' : null,
  );

  const enrollmentByClassId = useMemo(() => {
    const map = new Map((myClasses ?? []).map((row) => [row.class.id, row.enrollment]));
    return map;
  }, [myClasses]);

  function handleEnrolled() {
    refetch();
    refetchMine();
  }

  const filteredClasses = (classes ?? []).filter((c) => (tab === 'upcoming' ? UPCOMING_STATUSES.has(c.status) : !UPCOMING_STATUSES.has(c.status)));
  const mineFiltered = (myClasses ?? []).filter((row) =>
    (!classType || row.class.classType === classType) &&
    (!searchInput || row.class.title.toLowerCase().includes(searchInput.toLowerCase())),
  );

  const loading = tab === 'mine' ? myClassesLoading : classesLoading;
  const items: { cls: LiveClass }[] = tab === 'mine' ? mineFiltered.map((row) => ({ cls: row.class })) : filteredClasses.map((cls) => ({ cls }));

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-text-primary mb-1">Live Classes</h1>
        <p className="text-text-secondary mb-6">Join group workshops or private tutoring, live.</p>

        <Tabs tabs={TABS} activeTab={tab} onChange={(v) => setTab(v as BrowseTab)} className="mb-6" />

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input placeholder="Search classes..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <select
            aria-label="Class type"
            value={classType ?? ''}
            onChange={(e) => setClassType((e.target.value || null) as ClassType | null)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
          >
            {CLASS_TYPES.map((opt) => (
              <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>
            ))}
          </select>
        </div>

        {tab === 'mine' && !isStudent && (
          <p className="text-text-secondary text-sm py-8 text-center">Log in to see the classes you&apos;re enrolled in.</p>
        )}

        {error && tab !== 'mine' && (
          <p className="text-error text-sm py-8 text-center">Couldn&apos;t load live classes right now. Please try again shortly.</p>
        )}

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton variant="rect" height={160} />
                <Skeleton variant="text" />
                <Skeleton variant="text" width="60%" />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && items.length === 0 && (tab !== 'mine' || isStudent) && (
          <p className="text-text-secondary text-sm py-8 text-center">
            {tab === 'mine' ? "You haven't enrolled in any classes yet." : 'No live classes match these filters yet.'}
          </p>
        )}

        {!loading && items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(({ cls }) => (
              <LiveClassCard
                key={cls.id}
                cls={cls}
                enrollment={enrollmentByClassId.get(cls.id)}
                isStudent={isStudent}
                onEnrolled={handleEnrolled}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
