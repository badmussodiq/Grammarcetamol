import { cookies } from 'next/headers';
import { Badge, DataTable } from '@grammarcetamol/utilities';
import type { DataTableColumn } from '@grammarcetamol/utilities';
import { RefundButton } from './RefundButton';
import type { Paged, Payment } from '@/lib/transactions.api';
import { buildTransactionsQuery } from '@/lib/transactions.api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
const PAGE_SIZE = 20;

async function authHeaders(): Promise<Record<string, string>> {
  const accessToken = (await cookies()).get('access_token')?.value;
  return accessToken ? { Cookie: `access_token=${accessToken}` } : {};
}

async function fetchTransactions(status: string, method: string, dateFrom: string, dateTo: string, page: number): Promise<Paged<Payment> | null> {
  const query = buildTransactionsQuery({ status, method, dateFrom, dateTo, page }, PAGE_SIZE);
  try {
    const res = await fetch(`${API_URL}/api/payments?${query}`, { headers: await authHeaders(), cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json();
    return body.data as Paged<Payment>;
  } catch {
    return null;
  }
}

const statusVariant: Record<Payment['status'], 'success' | 'warning' | 'neutral' | 'error' | 'info'> = {
  completed: 'success',
  pending: 'warning',
  processing: 'warning',
  failed: 'error',
  refunded: 'info',
  partially_refunded: 'info',
};

function formatAmount(payment: Payment): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: payment.currency }).format(Number(payment.amount));
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; method?: string; dateFrom?: string; dateTo?: string; page?: string }>;
}) {
  const resolved = await searchParams;
  const status = resolved.status ?? '';
  const method = resolved.method ?? '';
  const dateFrom = resolved.dateFrom ?? '';
  const dateTo = resolved.dateTo ?? '';
  const page = Number(resolved.page ?? '1') || 1;

  const result = await fetchTransactions(status, method, dateFrom, dateTo, page);

  const columns: DataTableColumn<Payment>[] = [
    { key: 'id', header: 'ID', cell: (p) => <span className="font-mono text-xs">{p.id.slice(0, 8)}…</span> },
    { key: 'date', header: 'Date', cell: (p) => new Date(p.createdAt).toLocaleDateString() },
    { key: 'user', header: 'Student', cell: (p) => <span className="font-mono text-xs">{p.userId.slice(0, 8)}…</span> },
    { key: 'course', header: 'Course', cell: (p) => (p.courseId ? <span className="font-mono text-xs">{p.courseId.slice(0, 8)}…</span> : '—') },
    { key: 'amount', header: 'Amount', cell: (p) => formatAmount(p) },
    { key: 'method', header: 'Method', cell: (p) => p.paymentMethod },
    { key: 'status', header: 'Status', cell: (p) => <Badge variant={statusVariant[p.status]} size="sm">{p.status}</Badge> },
    {
      key: 'actions',
      header: 'Actions',
      cell: (p) =>
        p.status === 'completed' || p.status === 'partially_refunded' ? (
          <RefundButton paymentId={p.id} maxAmount={Number(p.amount)} currency={p.currency} />
        ) : null,
    },
  ];

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Transactions</h1>
          <p className="text-text-secondary mt-1 text-sm">Payment ledger and refunds.</p>
        </div>

        <form action="/transactions" className="flex flex-wrap gap-3">
          <select name="status" defaultValue={status} className="rounded-md border border-border px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="partially_refunded">Partially Refunded</option>
          </select>
          <select name="method" defaultValue={method} className="rounded-md border border-border px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40">
            <option value="">All methods</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="wallet">Wallet</option>
          </select>
          <input type="date" name="dateFrom" defaultValue={dateFrom} className="rounded-md border border-border px-3 py-2 text-sm" />
          <input type="date" name="dateTo" defaultValue={dateTo} className="rounded-md border border-border px-3 py-2 text-sm" />
          <button type="submit" className="rounded-md border border-primary text-primary px-4 py-2 text-sm font-medium hover:bg-background">Filter</button>
        </form>

        {!result ? (
          <div className="bg-surface rounded-lg border border-border p-8 text-center text-text-secondary">
            Couldn&apos;t load transactions — your session may have expired. Try refreshing the page.
          </div>
        ) : (
          <>
            <DataTable columns={columns} data={result.items} keyExtractor={(p) => p.id} emptyMessage="No transactions found." />
            {result.total > PAGE_SIZE && (
              <div className="flex justify-between items-center text-sm text-text-secondary">
                <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, result.total)} of {result.total}</span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <a href={`/transactions?status=${status}&method=${method}&dateFrom=${dateFrom}&dateTo=${dateTo}&page=${page - 1}`} className="text-accent hover:underline">Previous</a>
                  )}
                  {page * PAGE_SIZE < result.total && (
                    <a href={`/transactions?status=${status}&method=${method}&dateFrom=${dateFrom}&dateTo=${dateTo}&page=${page + 1}`} className="text-accent hover:underline">Next</a>
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
