'use client';

import { Skeleton, useFetch } from '@grammarcetamol/utilities';
import type { Enrollment } from '@/lib/students.api';
import type { Paged, Payment } from '@/lib/transactions.api';
import { useCourseTitles } from './useCourseTitles';

interface ActivityEvent {
  timestamp: string;
  label: string;
}

/** No activity-log service exists anywhere in the codebase — this is a client-side merge of the
 * timestamped signals that do exist (logins, enrollments, completions, payments), not a real
 * event stream. Revisit if an actual audit/activity log gets built. */
export function ActivityTab({ studentId, lastLoginAt }: { studentId: string; lastLoginAt: string | null }) {
  const { data: enrollments, loading: enrollmentsLoading } = useFetch<Enrollment[]>(`/api/enrollments/user/${studentId}`);
  const { data: payments, loading: paymentsLoading } = useFetch<Paged<Payment>>(`/api/payments?userId=${studentId}&limit=100`);
  const titles = useCourseTitles(enrollments?.map((e) => e.courseId) ?? []);

  if (enrollmentsLoading || paymentsLoading) {
    return <Skeleton variant="rect" height={200} />;
  }

  const events: ActivityEvent[] = [];

  if (lastLoginAt) {
    events.push({ timestamp: lastLoginAt, label: 'Last logged in' });
  }
  for (const e of enrollments ?? []) {
    const title = titles[e.courseId] ?? e.courseId.slice(0, 8) + '…';
    events.push({ timestamp: e.enrolledAt, label: `Enrolled in ${title}` });
    if (e.completedAt) {
      events.push({ timestamp: e.completedAt, label: `Completed ${title}` });
    }
  }
  for (const p of payments?.items ?? []) {
    if (p.status === 'completed' && p.paidAt) {
      events.push({ timestamp: p.paidAt, label: `Paid ${p.amount} ${p.currency}` });
    } else if (p.status === 'failed' && p.failedAt) {
      events.push({ timestamp: p.failedAt, label: `Payment failed — ${p.failureReason ?? 'unknown reason'}` });
    }
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (events.length === 0) {
    return <p className="text-sm text-[#64748B]">No activity yet.</p>;
  }

  return (
    <div className="bg-surface rounded-lg border border-border divide-y divide-border">
      {events.map((event, i) => (
        <div key={i} className="px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-[#0F172A]">{event.label}</span>
          <span className="text-[#64748B]">{new Date(event.timestamp).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
