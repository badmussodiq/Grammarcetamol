'use client';

import {useParams} from 'next/navigation';
import Link from 'next/link';
import {Badge, Skeleton, useFetch} from '@grammarcetamol/utilities';
import type {PaymentStatus, TransactionDetail} from '@/lib/transactions.api';

const STATUS_BADGE: Record<PaymentStatus, { variant: 'success' | 'warning' | 'error' | 'neutral'; label: string }> = {
  completed: { variant: 'success', label: 'Completed' },
  pending: { variant: 'warning', label: 'Pending' },
  processing: { variant: 'warning', label: 'Processing' },
  failed: { variant: 'error', label: 'Failed' },
  refunded: { variant: 'neutral', label: 'Refunded' },
  partially_refunded: { variant: 'neutral', label: 'Partially Refunded' },
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-border last:border-b-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}

export default function TransactionDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: tx, loading, error } = useFetch<TransactionDetail>(`/api/payments/${params.id}`);

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/transactions" className="text-sm text-primary hover:underline mb-4 inline-block">
          ← Back to Transactions
        </Link>
        <h1 className="text-2xl font-bold text-text-primary mb-6">Transaction Detail</h1>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rect" height={40} />)}
          </div>
        ) : error || !tx ? (
          <p className="text-text-secondary">Transaction not found.</p>
        ) : (
          <div className="rounded-lg border border-border bg-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-2xl font-bold text-text-primary">
                {tx.currency} {Number(tx.amount).toLocaleString()}
              </p>
              <Badge variant={STATUS_BADGE[tx.status].variant}>{STATUS_BADGE[tx.status].label}</Badge>
            </div>

            {tx.course && (
              <Link href={`/courses/${tx.course.slug}`} className="text-sm text-primary hover:underline block mb-4">
                {tx.course.title} →
              </Link>
            )}

            <Row label="Description" value={tx.description ?? '—'} />
            <Row label="Payment method" value={tx.paymentMethod} />
            <Row label="Gateway" value={tx.gateway} />
            <Row label="Reference" value={tx.gatewayRef} />
            <Row label="Created" value={new Date(tx.createdAt).toLocaleString()} />
            {tx.paidAt && <Row label="Paid at" value={new Date(tx.paidAt).toLocaleString()} />}
            {tx.failedAt && <Row label="Failed at" value={new Date(tx.failedAt).toLocaleString()} />}
            {tx.failureReason && <Row label="Failure reason" value={tx.failureReason} />}
          </div>
        )}
      </div>
    </main>
  );
}
