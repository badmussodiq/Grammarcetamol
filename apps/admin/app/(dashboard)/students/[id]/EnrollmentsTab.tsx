'use client';

import {Badge, Skeleton, useFetch} from '@grammarcetamol/utilities';
import type {Enrollment} from '@/lib/students.api';
import {useCourseTitles} from './useCourseTitles';

const statusVariant: Record<Enrollment['status'], 'success' | 'warning' | 'neutral' | 'error'> = {
  active: 'warning',
  completed: 'success',
  dropped: 'neutral',
  expired: 'error',
};

export function EnrollmentsTab({ studentId }: { studentId: string }) {
  const { data: enrollments, loading, error } = useFetch<Enrollment[]>(`/api/enrollments/user/${studentId}`);
  const titles = useCourseTitles(enrollments?.map((e) => e.courseId) ?? []);

  if (loading) {
    return <Skeleton variant="rect" height={200} />;
  }

  if (error) {
    return <p className="text-sm text-[#64748B]">Couldn&apos;t load enrollments.</p>;
  }

  if (!enrollments || enrollments.length === 0) {
    return <p className="text-sm text-[#64748B]">No enrollments yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {enrollments.map((e) => (
        <div key={e.id} className="bg-surface rounded-lg border border-border p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-[#0F172A]">{titles[e.courseId] ?? e.courseId.slice(0, 8) + '…'}</p>
            <p className="text-xs text-[#64748B] mt-1">
              Enrolled {new Date(e.enrolledAt).toLocaleDateString()}
              {e.completedAt && <> · Completed {new Date(e.completedAt).toLocaleDateString()}</>}
              {' · '}{Number(e.pricePaid) === 0 ? 'Free' : `${e.pricePaid} ${e.currency}`}
            </p>
          </div>
          <Badge variant={statusVariant[e.status]} size="sm">{e.status}</Badge>
        </div>
      ))}
    </div>
  );
}
