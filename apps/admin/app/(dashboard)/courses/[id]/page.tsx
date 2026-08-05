'use client';

import { Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Tabs, useFetch, Skeleton } from '@grammarcetamol/utilities';
import { OverviewTab } from './OverviewTab';
import { EditTab } from './EditTab';
import { ContentTab } from './ContentTab';
import { VersionsTab } from './VersionsTab';
import type { CourseDetailResponse } from '@/lib/courses.api';

const TABS = [
  { label: 'Overview', value: 'overview' },
  { label: 'Edit', value: 'edit' },
  { label: 'Content', value: 'content' },
  { label: 'Versions', value: 'versions' },
];

export default function CourseDetailPage() {
  return (
    <Suspense>
      <CourseDetailShell />
    </Suspense>
  );
}

function CourseDetailShell() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'overview';
  const { data, loading, error, refetch } = useFetch<CourseDetailResponse>(`/api/courses/${params.id}`);

  function setTab(tab: string) {
    router.replace(`/courses/${params.id}?tab=${tab}`, { scroll: false });
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

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background p-8 text-center">
        <p className="text-[#64748B] mb-2">Couldn&apos;t load this course.</p>
        <Link href="/courses" className="text-accent hover:underline">Back to Courses</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/courses" className="text-sm text-accent hover:underline">← Back to Courses</Link>
        <h1 className="text-2xl font-bold text-[#0F172A] mt-3 mb-4">{data.course.title}</h1>
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setTab} className="mb-6" />
        {activeTab === 'overview' && <OverviewTab course={data.course} modules={data.modules} onChanged={refetch} />}
        {activeTab === 'edit' && <EditTab course={data.course} onSaved={refetch} />}
        {activeTab === 'content' && <ContentTab courseId={data.course.id} modules={data.modules} onChanged={refetch} />}
        {activeTab === 'versions' && <VersionsTab courseId={data.course.id} onRestored={refetch} />}
      </div>
    </div>
  );
}
