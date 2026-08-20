'use client';

import {Suspense, useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import type {DataTableColumn} from '@grammarcetamol/utilities';
import {ApiError, Badge, Button, DataTable, Skeleton, useFetch, useToast} from '@grammarcetamol/utilities';
import {instructorsApi, type InstructorOption} from '@/lib/classes.api';
import {
  type Announcement,
  type AnnouncementStatus,
  announcementsApi,
  buildAnnouncementQuery,
  formatTargetAudience,
  type Paged,
  PRIORITY_BADGE_VARIANT,
  STATUS_BADGE_VARIANT,
} from '@/lib/announcements.api';

export default function AnnouncementsPage() {
  return (
    <Suspense>
      <AnnouncementsShell />
    </Suspense>
  );
}

function AnnouncementsShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const status = (searchParams.get('status') as AnnouncementStatus | null) ?? '';

  const { data, loading, error, refetch } = useFetch<Paged<Announcement>>(
    `/api/announcements${buildAnnouncementQuery({ status: status || undefined })}`,
  );
  const [authors, setAuthors] = useState<InstructorOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    instructorsApi.list().then(setAuthors).catch(() => setAuthors([]));
  }, []);

  function authorName(id: string): string {
    const found = authors.find((a) => a.id === id);
    return found ? (found.fullName ?? found.email) : id;
  }

  function setStatus(next: string) {
    setSelected(new Set());
    router.replace(next ? `/announcements?status=${next}` : '/announcements', { scroll: false });
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data) return;
    setSelected((prev) => (prev.size === data.items.length ? new Set() : new Set(data.items.map((a) => a.id))));
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} announcement(s)? This can't be undone.`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all(Array.from(selected).map((id) => announcementsApi.remove(id)));
      addToast({ type: 'success', message: `${selected.size} announcement(s) deleted` });
      setSelected(new Set());
      refetch();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Some deletes failed — refreshing the list' });
      setSelected(new Set());
      refetch();
    } finally {
      setBulkDeleting(false);
    }
  }

  const columns: DataTableColumn<Announcement>[] = [
    {
      key: 'select',
      header: '',
      cell: (a) => <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelected(a.id)} aria-label={`Select ${a.title}`} />,
      className: 'w-10',
    },
    { key: 'title', header: 'Title', cell: (a) => <Link href={`/announcements/${a.id}`} className="text-accent hover:underline">{a.title}</Link> },
    { key: 'target', header: 'Target', cell: (a) => formatTargetAudience(a) },
    { key: 'priority', header: 'Priority', cell: (a) => <Badge variant={PRIORITY_BADGE_VARIANT[a.priority]} size="sm">{a.priority}</Badge> },
    { key: 'status', header: 'Status', cell: (a) => <Badge variant={STATUS_BADGE_VARIANT[a.status]} size="sm">{a.status}</Badge> },
    {
      key: 'publishDate',
      header: 'Publish Date',
      cell: (a) => {
        if (a.publishedAt) return new Date(a.publishedAt).toLocaleDateString();
        if (a.publishAt) return `Scheduled ${new Date(a.publishAt).toLocaleDateString()}`;
        return '—';
      },
    },
    { key: 'author', header: 'Author', cell: (a) => authorName(a.createdBy) },
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Announcements</h1>
            <p className="text-text-secondary mt-1 text-sm">Create, target, and publish platform announcements.</p>
          </div>
          <Link href="/announcements/create"><Button>+ New Announcement</Button></Link>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="expired">Expired</option>
          </select>
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" loading={bulkDeleting} onClick={handleBulkDelete}>
              Delete Selected ({selected.size})
            </Button>
          )}
        </div>

        {error && (
          <div className="bg-surface rounded-lg border border-border p-8 text-center text-text-secondary">
            Couldn&apos;t load announcements — your session may have expired. Try refreshing the page.
          </div>
        )}

        {!error && loading && <Skeleton variant="rect" height={320} />}

        {!error && !loading && data && (
          <>
            {data.items.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-[#64748B] w-fit">
                <input type="checkbox" checked={selected.size > 0 && selected.size === data.items.length} onChange={toggleSelectAll} />
                Select all on this page
              </label>
            )}
            <DataTable columns={columns} data={data.items} keyExtractor={(a) => a.id} emptyMessage="No announcements yet." />
          </>
        )}
      </div>
    </div>
  );
}
