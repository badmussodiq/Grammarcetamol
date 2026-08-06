import { cookies } from 'next/headers';
import Link from 'next/link';
import { Badge, DataTable } from '@grammarcetamol/utilities';
import type { DataTableColumn } from '@grammarcetamol/utilities';
import type { Paged, Review } from '@/lib/reviews.api';
import { buildReviewsQuery } from '@/lib/reviews.api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
const PAGE_SIZE = 20;

async function authHeaders(): Promise<Record<string, string>> {
  const accessToken = (await cookies()).get('access_token')?.value;
  return accessToken ? { Cookie: `access_token=${accessToken}` } : {};
}

async function fetchReviews(status: string, courseId: string, rating: string, page: number): Promise<Paged<Review> | null> {
  const query = buildReviewsQuery({ status, courseId, rating, page }, PAGE_SIZE);
  try {
    const res = await fetch(`${API_URL}/api/reviews?${query}`, { headers: await authHeaders(), cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json();
    return body.data as Paged<Review>;
  } catch {
    return null;
  }
}

const statusVariant: Record<Review['status'], 'success' | 'warning' | 'neutral' | 'error' | 'info'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  flagged: 'info',
};

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; courseId?: string; rating?: string; page?: string }>;
}) {
  const resolved = await searchParams;
  const status = resolved.status ?? '';
  const courseId = resolved.courseId ?? '';
  const rating = resolved.rating ?? '';
  const page = Number(resolved.page ?? '1') || 1;

  const result = await fetchReviews(status, courseId, rating, page);

  const columns: DataTableColumn<Review>[] = [
    { key: 'id', header: 'ID', cell: (r) => <Link href={`/reviews/${r.id}`} className="font-mono text-xs text-accent hover:underline">{r.id.slice(0, 8)}…</Link> },
    { key: 'date', header: 'Date', cell: (r) => new Date(r.createdAt).toLocaleDateString() },
    { key: 'user', header: 'Student', cell: (r) => <span className="font-mono text-xs">{r.userId.slice(0, 8)}…</span> },
    { key: 'course', header: 'Course', cell: (r) => <span className="font-mono text-xs">{r.courseId.slice(0, 8)}…</span> },
    { key: 'rating', header: 'Rating', cell: (r) => `${r.rating} ★` },
    { key: 'title', header: 'Title', cell: (r) => r.title || '—' },
    { key: 'status', header: 'Status', cell: (r) => <Badge variant={statusVariant[r.status]} size="sm">{r.status}</Badge> },
    { key: 'actions', header: 'Actions', cell: (r) => <Link href={`/reviews/${r.id}`} className="text-accent hover:underline text-sm">View</Link> },
  ];

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Reviews</h1>
          <p className="text-text-secondary mt-1 text-sm">Course review moderation queue.</p>
        </div>

        <form action="/reviews" className="flex flex-wrap gap-3">
          <select name="status" defaultValue={status} className="rounded-md border border-border px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="flagged">Flagged</option>
          </select>
          <select name="rating" defaultValue={rating} className="rounded-md border border-border px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40">
            <option value="">All ratings</option>
            <option value="5">5 ★</option>
            <option value="4">4 ★</option>
            <option value="3">3 ★</option>
            <option value="2">2 ★</option>
            <option value="1">1 ★</option>
          </select>
          <input type="text" name="courseId" defaultValue={courseId} placeholder="Course ID" className="rounded-md border border-border px-3 py-2 text-sm" />
          <button type="submit" className="rounded-md border border-primary text-primary px-4 py-2 text-sm font-medium hover:bg-background">Filter</button>
        </form>

        {!result ? (
          <div className="bg-surface rounded-lg border border-border p-8 text-center text-text-secondary">
            Couldn&apos;t load reviews — your session may have expired. Try refreshing the page.
          </div>
        ) : (
          <>
            <DataTable columns={columns} data={result.items} keyExtractor={(r) => r.id} emptyMessage="No reviews found." />
            {result.total > PAGE_SIZE && (
              <div className="flex justify-between items-center text-sm text-text-secondary">
                <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, result.total)} of {result.total}</span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <a href={`/reviews?status=${status}&courseId=${courseId}&rating=${rating}&page=${page - 1}`} className="text-accent hover:underline">Previous</a>
                  )}
                  {page * PAGE_SIZE < result.total && (
                    <a href={`/reviews?status=${status}&courseId=${courseId}&rating=${rating}&page=${page + 1}`} className="text-accent hover:underline">Next</a>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
