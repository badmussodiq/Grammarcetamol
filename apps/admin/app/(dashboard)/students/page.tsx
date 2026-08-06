import { cookies } from 'next/headers';
import Link from 'next/link';
import { Badge, Button, DataTable } from '@grammarcetamol/utilities';
import type { DataTableColumn } from '@grammarcetamol/utilities';
import { toggleStudentStatus } from './actions';
import type { Student, UserListResult } from '@/lib/students.api';
import { buildStudentsQuery } from '@/lib/students.api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
const PAGE_SIZE = 20;

async function fetchStudents(q: string, status: string, page: number): Promise<UserListResult | null> {
  const accessToken = (await cookies()).get('access_token')?.value;
  const query = buildStudentsQuery({ q, status, page }, PAGE_SIZE);
  try {
    const res = await fetch(`${API_URL}/api/users?${query}`, {
      headers: accessToken ? { Cookie: `access_token=${accessToken}` } : {},
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.data as UserListResult;
  } catch {
    return null;
  }
}

const statusVariant: Record<Student['status'], 'success' | 'error' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  SUSPENDED: 'error',
  PENDING_VERIFICATION: 'warning',
  DELETED: 'neutral',
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const resolved = await searchParams;
  const q = resolved.q ?? '';
  const status = resolved.status ?? '';
  const page = Number(resolved.page ?? '1') || 1;

  const result = await fetchStudents(q, status, page);

  const columns: DataTableColumn<Student>[] = [
    { key: 'name', header: 'Name', cell: (s) => <Link href={`/students/${s.id}`} className="text-accent hover:underline">{s.fullName ?? '—'}</Link> },
    { key: 'email', header: 'Email', cell: (s) => s.email },
    { key: 'phone', header: 'Phone', cell: (s) => s.phone ?? '—' },
    { key: 'country', header: 'Country', cell: (s) => s.country ?? '—' },
    { key: 'created', header: 'Registered', cell: (s) => new Date(s.createdAt).toLocaleDateString() },
    { key: 'lastActive', header: 'Last Active', cell: (s) => (s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleDateString() : 'Never') },
    { key: 'status', header: 'Status', cell: (s) => <Badge variant={statusVariant[s.status]} size="sm">{s.status}</Badge> },
    {
      key: 'actions',
      header: 'Actions',
      cell: (s) => (
        <div className="flex items-center gap-3">
          <Link href={`/students/${s.id}`} className="text-accent hover:underline text-sm">View</Link>
          {(s.status === 'ACTIVE' || s.status === 'SUSPENDED') && (
            <form action={toggleStudentStatus}>
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="status" value={s.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'} />
              <Button type="submit" variant="ghost" size="sm">{s.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}</Button>
            </form>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Students</h1>
          <p className="text-text-secondary mt-1 text-sm">Student directory.</p>
        </div>

        <form action="/students" className="flex flex-wrap gap-3">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by name or email…"
            className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40"
          />
          <select name="status" defaultValue={status} className="rounded-md border border-border px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="PENDING_VERIFICATION">Unverified</option>
          </select>
          <button type="submit" className="rounded-md border border-primary text-primary px-4 py-2 text-sm font-medium hover:bg-background">Filter</button>
        </form>

        {!result ? (
          <div className="bg-surface rounded-lg border border-border p-8 text-center text-text-secondary">
            Couldn&apos;t load students — your session may have expired. Try refreshing the page.
          </div>
        ) : (
          <>
            <DataTable columns={columns} data={result.data} keyExtractor={(s) => s.id} emptyMessage="No students found." />
            {result.total > PAGE_SIZE && (
              <div className="flex justify-between items-center text-sm text-text-secondary">
                <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, result.total)} of {result.total}</span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <a href={`/students?q=${encodeURIComponent(q)}&status=${status}&page=${page - 1}`} className="text-accent hover:underline">Previous</a>
                  )}
                  {page * PAGE_SIZE < result.total && (
                    <a href={`/students?q=${encodeURIComponent(q)}&status=${status}&page=${page + 1}`} className="text-accent hover:underline">Next</a>
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
