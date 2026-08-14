'use client';

import {useState} from 'react';
import Link from 'next/link';
import {Badge, DataTable, useFetch} from '@grammarcetamol/utilities';
import {buildTransactionsQuery, type Paged, type PaymentStatus, type Transaction} from '@/lib/transactions.api';

const STATUS_FILTERS: { label: string; value: PaymentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Pending', value: 'pending' },
  { label: 'Failed', value: 'failed' },
  { label: 'Refunded', value: 'refunded' },
];

const STATUS_BADGE: Record<PaymentStatus, { variant: 'success' | 'warning' | 'error' | 'neutral'; label: string }> = {
  completed: { variant: 'success', label: 'Completed' },
  pending: { variant: 'warning', label: 'Pending' },
  processing: { variant: 'warning', label: 'Processing' },
  failed: { variant: 'error', label: 'Failed' },
  refunded: { variant: 'neutral', label: 'Refunded' },
  partially_refunded: { variant: 'neutral', label: 'Partially Refunded' },
};

export default function TransactionsPage() {
  const [status, setStatus] = useState<PaymentStatus | 'all'>('all');
  const query = buildTransactionsQuery({ status: status === 'all' ? undefined : status, limit: 50 });
  const { data, loading } = useFetch<Paged<Transaction>>(`/api/payments/me${query}`);

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Transactions</h1>
        <p className="text-text-secondary mb-6">A record of every payment you&apos;ve made.</p>

        <div className="flex gap-2 flex-wrap mb-6">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              className={
                status === f.value
                  ? 'px-3 py-1.5 rounded-full text-sm font-medium bg-primary text-white'
                  : 'px-3 py-1.5 rounded-full text-sm font-medium bg-surface border border-border text-text-secondary hover:bg-background'
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <DataTable<Transaction>
          data={loading ? null : (data?.items ?? [])}
          keyExtractor={(t) => t.id}
          emptyMessage="No transactions yet."
          columns={[
            {
              key: 'date',
              header: 'Date',
              cell: (t) => (
                <Link href={`/transactions/${t.id}`} className="text-primary hover:underline">
                  {new Date(t.createdAt).toLocaleDateString()}
                </Link>
              ),
            },
            {
              key: 'description',
              header: 'Description',
              cell: (t) => t.description ?? (t.courseId ? 'Course purchase' : 'Payment'),
            },
            {
              key: 'amount',
              header: 'Amount',
              cell: (t) => `${t.currency} ${Number(t.amount).toLocaleString()}`,
            },
            {
              key: 'status',
              header: 'Status',
              cell: (t) => <Badge variant={STATUS_BADGE[t.status].variant}>{STATUS_BADGE[t.status].label}</Badge>,
            },
          ]}
        />
      </div>
    </main>
  );
}
