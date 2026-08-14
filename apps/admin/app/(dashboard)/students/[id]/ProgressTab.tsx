'use client';

import {useEffect, useState} from 'react';
import {ProgressBar, Skeleton, useFetch} from '@grammarcetamol/utilities';
import {type Enrollment, studentsApi} from '@/lib/students.api';
import {useCourseTitles} from './useCourseTitles';

export function ProgressTab({ studentId }: { studentId: string }) {
  const { data: enrollments, loading, error } = useFetch<Enrollment[]>(`/api/enrollments/user/${studentId}`);
  const titles = useCourseTitles(enrollments?.map((e) => e.courseId) ?? []);
  const [completionByCourse, setCompletionByCourse] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!enrollments) return;
    let cancelled = false;
    Promise.all(
      enrollments.map((e) =>
        studentsApi
          .completion(studentId, e.courseId)
          .then((res) => [e.courseId, res.data.completionPct] as const)
          .catch(() => [e.courseId, 0] as const),
      ),
    ).then((pairs) => {
      if (!cancelled) setCompletionByCourse(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments?.map((e) => e.id).join(',')]);

  if (loading) {
    return <Skeleton variant="rect" height={200} />;
  }

  if (error) {
    return <p className="text-sm text-[#64748B]">Couldn&apos;t load progress.</p>;
  }

  if (!enrollments || enrollments.length === 0) {
    return <p className="text-sm text-[#64748B]">No courses in progress.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {enrollments.map((e) => (
        <div key={e.id} className="bg-surface rounded-lg border border-border p-4">
          <p className="font-medium text-[#0F172A] mb-2">{titles[e.courseId] ?? e.courseId.slice(0, 8) + '…'}</p>
          <ProgressBar value={completionByCourse[e.courseId] ?? 0} showLabel />
        </div>
      ))}
    </div>
  );
}
