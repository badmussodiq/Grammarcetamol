'use client';

import {useState} from 'react';
import {ApiError, Badge, Button, DataTable, useFetch, useToast} from '@grammarcetamol/utilities';
import type {DataTableColumn} from '@grammarcetamol/utilities';
import {classesApi, type EnrollmentRow, type EnrollmentStatus} from '@/lib/classes.api';

const statusVariant: Record<EnrollmentStatus, 'success' | 'info' | 'neutral' | 'error' | 'warning'> = {
  ACTIVE: 'success',
  PENDING_PAYMENT: 'warning',
  PAUSED: 'info',
  CANCELLED: 'error',
  EXPIRED: 'neutral',
  REMOVED: 'neutral',
  COMPLETED: 'neutral',
};

export function EnrollmentsTab({ classId }: { classId: string }) {
  const { addToast } = useToast();
  const { data: rows, loading, refetch } = useFetch<EnrollmentRow[]>(`/api/classes/${classId}/enrollments`);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleRemove(row: EnrollmentRow) {
    if (!confirm(`Remove ${row.student.fullName ?? row.student.email} from this class? Their access ends immediately.`)) return;
    setBusyId(row.enrollment.id);
    try {
      await classesApi.removeEnrollment(row.enrollment.id);
      addToast({ type: 'success', message: 'Student removed' });
      refetch();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not remove student' });
    } finally {
      setBusyId(null);
    }
  }

  const columns: DataTableColumn<EnrollmentRow>[] = [
    { key: 'student', header: 'Student', cell: (r) => (
      <div>
        <div className="text-[#0F172A]">{r.student.fullName ?? 'Unknown'}</div>
        <div className="text-xs text-[#94A3B8]">{r.student.email}</div>
      </div>
    ) },
    { key: 'status', header: 'Status', cell: (r) => <Badge variant={statusVariant[r.enrollment.status]} size="sm">{r.enrollment.status}</Badge> },
    { key: 'accessUntil', header: 'Access Until', cell: (r) => new Date(r.enrollment.accessUntil).toLocaleDateString() },
    { key: 'enrolledAt', header: 'Enrolled', cell: (r) => new Date(r.enrollment.enrolledAt).toLocaleDateString() },
    { key: 'actions', header: '', cell: (r) => (
      r.enrollment.status === 'REMOVED' ? null : (
        <Button size="sm" variant="destructive" loading={busyId === r.enrollment.id} onClick={() => handleRemove(r)}>Remove</Button>
      )
    ) },
  ];

  return (
    <div className="mt-6">
      <DataTable
        columns={columns}
        data={loading ? null : rows}
        keyExtractor={(r) => r.enrollment.id}
        emptyMessage="No students enrolled yet."
      />
    </div>
  );
}
