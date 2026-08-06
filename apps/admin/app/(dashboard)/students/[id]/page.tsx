'use client';

import { Suspense, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Badge, Button, Skeleton, Tabs, useFetch, useToast, ApiError } from '@grammarcetamol/utilities';
import { studentsApi, type Student } from '@/lib/students.api';
import { ActivityTab } from './ActivityTab';
import { EnrollmentsTab } from './EnrollmentsTab';
import { ProgressTab } from './ProgressTab';
import { TransactionsTab } from './TransactionsTab';

const TABS = [
  { label: 'Activity', value: 'activity' },
  { label: 'Enrollments', value: 'enrollments' },
  { label: 'Progress', value: 'progress' },
  { label: 'Transactions', value: 'transactions' },
];

const statusVariant: Record<Student['status'], 'success' | 'error' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  SUSPENDED: 'error',
  PENDING_VERIFICATION: 'warning',
  DELETED: 'neutral',
};

export default function StudentDetailPage() {
  return (
    <Suspense>
      <StudentDetailShell />
    </Suspense>
  );
}

function StudentDetailShell() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'activity';
  const { addToast } = useToast();
  const { data: student, loading, error, refetch } = useFetch<Student>(`/api/users/${params.id}`);
  const [busy, setBusy] = useState(false);

  function setTab(tab: string) {
    router.replace(`/students/${params.id}?tab=${tab}`, { scroll: false });
  }

  async function toggleStatus() {
    if (!student) return;
    const nextStatus = student.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    setBusy(true);
    try {
      await studentsApi.updateStatus(student.id, nextStatus);
      addToast({ type: 'success', message: nextStatus === 'SUSPENDED' ? 'Student suspended.' : 'Student activated.' });
      refetch();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to update status' });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          <Skeleton variant="text" width="40%" height={28} />
          <Skeleton variant="rect" height={200} />
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-background p-8 text-center">
        <p className="text-[#64748B] mb-2">Couldn&apos;t load this student.</p>
        <Link href="/students" className="text-accent hover:underline">Back to Students</Link>
      </div>
    );
  }

  const initial = (student.fullName ?? student.email).charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/students" className="text-sm text-accent hover:underline">← Back to Students</Link>

        <div className="bg-surface rounded-lg border border-border p-6 mt-3 mb-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-xl font-semibold flex-shrink-0">
                {initial}
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#0F172A]">{student.fullName ?? 'Unnamed student'}</h1>
                <p className="text-sm text-[#64748B]">{student.email}</p>
              </div>
              <Badge variant={statusVariant[student.status]}>{student.status}</Badge>
            </div>
            {(student.status === 'ACTIVE' || student.status === 'SUSPENDED') && (
              <Button size="sm" variant={student.status === 'SUSPENDED' ? 'primary' : 'destructive'} loading={busy} onClick={toggleStatus}>
                {student.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
              </Button>
            )}
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm border-t border-border pt-4">
            <div><dt className="text-[#64748B]">Registered</dt><dd className="text-[#0F172A]">{new Date(student.createdAt).toLocaleDateString()}</dd></div>
            <div><dt className="text-[#64748B]">Country</dt><dd className="text-[#0F172A]">{student.country ?? '—'}</dd></div>
            <div><dt className="text-[#64748B]">Timezone</dt><dd className="text-[#0F172A]">{student.timezone ?? '—'}</dd></div>
            <div><dt className="text-[#64748B]">Phone</dt><dd className="text-[#0F172A]">{student.phone ?? '—'}</dd></div>
            {student.learningGoals && student.learningGoals.length > 0 && (
              <div className="col-span-2 sm:col-span-4"><dt className="text-[#64748B]">Learning goals</dt><dd className="text-[#0F172A]">{student.learningGoals.join(', ')}</dd></div>
            )}
            {student.bio && (
              <div className="col-span-2 sm:col-span-4"><dt className="text-[#64748B]">Bio</dt><dd className="text-[#0F172A] whitespace-pre-line">{student.bio}</dd></div>
            )}
          </dl>
        </div>

        <Tabs tabs={TABS} activeTab={activeTab} onChange={setTab} className="mb-6" />
        {activeTab === 'activity' && <ActivityTab studentId={student.id} lastLoginAt={student.lastLoginAt} />}
        {activeTab === 'enrollments' && <EnrollmentsTab studentId={student.id} />}
        {activeTab === 'progress' && <ProgressTab studentId={student.id} />}
        {activeTab === 'transactions' && <TransactionsTab studentId={student.id} />}
      </div>
    </div>
  );
}
