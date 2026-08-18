import {cookies} from 'next/headers';
import Link from 'next/link';
import {Badge, Button, Mapping} from '@grammarcetamol/utilities';
import {toggleUserStatus} from './actions';
import type {StaffUser, UserListResult} from '@/lib/users.api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
const PAGE_SIZE = 20;

async function fetchUsers(q: string, page: number): Promise<UserListResult | null> {
  const accessToken = (await cookies()).get('access_token')?.value;
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (q) params.set('q', q);

  try {
    const res = await fetch(`${API_URL}/api/users?${params.toString()}`, {
      headers: accessToken ? { Cookie: `access_token=${accessToken}` } : {},
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('fetchUsers non-ok response:', res.status, await res.text());
      return null;
    }
    const body = await res.json();
    return body.data as UserListResult;
  } catch (err) {
    console.error('fetchUsers threw:', err);
    return null;
  }
}

const roleVariant: Record<StaffUser['role'], 'success' | 'info' | 'warning' | 'neutral'> = {
  SUPER_ADMIN: 'success',
  MODERATOR: 'info',
  CUSTOMER_SUPPORT: 'warning',
  STUDENT: 'neutral',
};

const statusVariant: Record<StaffUser['status'], 'success' | 'error' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  SUSPENDED: 'error',
  PENDING_VERIFICATION: 'warning',
  DELETED: 'neutral',
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const q = resolvedSearchParams.q ?? '';
  const page = Number(resolvedSearchParams.page ?? '1') || 1;
  const result = await fetchUsers(q, page);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Users</h1>
            <p className="text-[#64748B] mt-1 text-sm">Staff accounts — moderators and customer support.</p>
          </div>
          <Link href="/users/create">
            <Button>+ Create User</Button>
          </Link>
        </div>

        <form action="/users" className="mb-4">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by name or email…"
            className="w-full max-w-sm rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40"
          />
        </form>

        {!result ? (
          <div className="bg-surface rounded-lg border border-border p-8 text-center text-[#64748B]">
            Couldn&apos;t load users — your session may have expired. Try refreshing the page.
          </div>
        ) : result.data.length === 0 ? (
          <div className="bg-surface rounded-lg border border-border p-8 text-center text-[#64748B]">
            No users found.
          </div>
        ) : (
          <div className="bg-surface rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-background text-left text-xs font-semibold text-[#64748B] uppercase">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                <Mapping array={result.data} keyExtractor={(u) => u.id} wrapper={false}>
                  {(u) => (
                    <tr className="border-t border-border">
                      <td className="px-4 py-3 text-[#0F172A]">{u.fullName ?? '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={roleVariant[u.role]} size="sm">{u.role}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[u.status]} size="sm">{u.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {(u.status === 'ACTIVE' || u.status === 'SUSPENDED') && (
                          <form action={toggleUserStatus}>
                            <input type="hidden" name="id" value={u.id} />
                            <input
                              type="hidden"
                              name="status"
                              value={u.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'}
                            />
                            <Button type="submit" variant="ghost" size="sm">
                              {u.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
                            </Button>
                          </form>
                        )}
                      </td>
                    </tr>
                  )}
                </Mapping>
              </tbody>
            </table>
          </div>
        )}

        {result && result.total > PAGE_SIZE && (
          <div className="flex justify-between items-center mt-4 text-sm text-[#64748B]">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, result.total)} of {result.total}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/users?q=${encodeURIComponent(q)}&page=${page - 1}`} className="text-accent hover:underline">
                  Previous
                </Link>
              )}
              {page * PAGE_SIZE < result.total && (
                <Link href={`/users?q=${encodeURIComponent(q)}&page=${page + 1}`} className="text-accent hover:underline">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
