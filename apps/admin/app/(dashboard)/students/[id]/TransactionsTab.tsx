'use client';

import { Badge, DataTable, Skeleton, useFetch } from '@grammarcetamol/utilities';
import type { DataTableColumn } from '@grammarcetamol/utilities';
import type { Paged, Payment } from '@/lib/transactions.api';

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

export function TransactionsTab({ studentId }: { studentId: string }) {
  const { data, loading, error } = useFetch<Paged<Payment>>(`/api/payments?userId=${studentId}&limit=100`);

  if (loading) {
    return <Skeleton variant="rect" height={200} />;
  }

  if (error || !data) {
    return <p className="text-sm text-[#64748B]">Couldn&apos;t load transactions.</p>;
  }

  const columns: DataTableColumn<Payment>[] = [
    { key: 'date', header: 'Date', cell: (p) => new Date(p.createdAt).toLocaleDateString() },
    { key: 'course', header: 'Course', cell: (p) => (p.courseId ? <span className="font-mono text-xs">{p.courseId.slice(0, 8)}…</span> : '—') },
    { key: 'amount', header: 'Amount', cell: (p) => formatAmount(p) },
    { key: 'method', header: 'Method', cell: (p) => p.paymentMethod },
    { key: 'status', header: 'Status', cell: (p) => <Badge variant={statusVariant[p.status]} size="sm">{p.status}</Badge> },
  ];

  return <DataTable columns={columns} data={data.items} keyExtractor={(p) => p.id} emptyMessage="No transactions yet." />;
}
