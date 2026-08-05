'use client';

import { useState } from 'react';
import { useFetch, Button, Skeleton, useToast, ApiError } from '@grammarcetamol/utilities';
import { coursesApi, type CourseVersion } from '@/lib/courses.api';

export function VersionsTab({ courseId, onRestored }: { courseId: string; onRestored: () => void }) {
  const { data: versions, loading, error, refetch } = useFetch<CourseVersion[]>(`/api/courses/${courseId}/versions`);
  const { addToast } = useToast();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function handleRestore(versionId: string, versionNumber: number) {
    if (!confirm(`Restore course content to version ${versionNumber}? Current state will be saved as a new version first.`)) return;
    setRestoringId(versionId);
    try {
      await coursesApi.restoreVersion(courseId, versionId);
      addToast({ type: 'success', message: `Restored to version ${versionNumber}.` });
      refetch();
      onRestored();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to restore version' });
    } finally {
      setRestoringId(null);
    }
  }

  if (loading) {
    return <Skeleton variant="rect" height={120} />;
  }

  if (error) {
    return <p className="text-sm text-error">Couldn&apos;t load version history.</p>;
  }

  if (!versions || versions.length === 0) {
    return (
      <p className="text-sm text-[#64748B]">
        No version history yet — a snapshot is taken automatically the first time you edit a published course.
      </p>
    );
  }

  return (
    <div className="bg-surface rounded-lg border border-border divide-y divide-border">
      {versions.map((v) => (
        <div key={v.id} className="flex items-center justify-between px-4 py-3 text-sm">
          <div>
            <p className="text-[#0F172A] font-medium">Version {v.version}</p>
            <p className="text-[#64748B]">{v.changeSummary ?? 'No summary'} · {new Date(v.createdAt).toLocaleString()}</p>
          </div>
          <Button size="sm" variant="secondary" loading={restoringId === v.id} onClick={() => handleRestore(v.id, v.version)}>
            Restore
          </Button>
        </div>
      ))}
    </div>
  );
}
