import { cookies } from 'next/headers';
import Link from 'next/link';
import { Badge, DataTable } from '@grammarcetamol/utilities';
import type { DataTableColumn } from '@grammarcetamol/utilities';
import { buildSupportQuery, type Paged, type SupportTicket } from '@/lib/support.api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9000';
const PAGE_SIZE = 20;

async function fetchTickets(status: string, page: number): Promise<Paged<SupportTicket> | null> {
  const accessToken = (await cookies()).get('access_token')?.value;

  try {
    const res = await fetch(`${API_URL}/api/support/tickets?${buildSupportQuery(status, page, PAGE_SIZE)}`, {
      headers: accessToken ? { Cookie: `access_token=${accessToken}` } : {},
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.data as Paged<SupportTicket>;
  } catch {
    return null;
  }
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const resolved = await searchParams;
  const status = resolved.status ?? '';
  const page = Number(resolved.page ?? '1') || 1;

  const result = await fetchTickets(status, page);

  const columns: DataTableColumn<SupportTicket>[] = [
    { key: 'name', header: 'Name', cell: (t) => <Link href={`/support/${t._id}`} className="text-accent hover:underline">{t.name}</Link> },
    { key: 'email', header: 'Email', cell: (t) => t.email },
    { key: 'subject', header: 'Subject', cell: (t) => t.subject },
    { key: 'submitted', header: 'Submitted', cell: (t) => new Date(t.createdAt).toLocaleString() },
    { key: 'status', header: 'Status', cell: (t) => <Badge variant={t.status === 'open' ? 'warning' : 'success'} size="sm">{t.status}</Badge> },
    { key: 'actions', header: 'Actions', cell: (t) => <Link href={`/support/${t._id}`} className="text-accent hover:underline text-sm">View</Link> },
  ];

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Support Tickets</h1>
          <p className="text-text-secondary mt-1 text-sm">Enquiries submitted by guests and students.</p>
        </div>

        <form action="/support" className="flex flex-wrap gap-3">
          <select name="status" defaultValue={status} className="rounded-md border border-border px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40">
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <button type="submit" className="rounded-md border border-primary text-primary px-4 py-2 text-sm font-medium hover:bg-background">Filter</button>
        </form>

        {!result ? (
          <div className="bg-surface rounded-lg border border-border p-8 text-center text-text-secondary">
            Couldn&apos;t load support tickets — your session may have expired. Try refreshing the page.
          </div>
        ) : (
          <>
            <DataTable columns={columns} data={result.items} keyExtractor={(t) => t._id} emptyMessage="No support tickets found." />
            {result.total > PAGE_SIZE && (
              <div className="flex justify-between items-center text-sm text-text-secondary">
                <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, result.total)} of {result.total}</span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <a href={`/support?status=${status}&page=${page - 1}`} className="text-accent hover:underline">Previous</a>
                  )}
                  {page * PAGE_SIZE < result.total && (
                    <a href={`/support?status=${status}&page=${page + 1}`} className="text-accent hover:underline">Next</a>
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
