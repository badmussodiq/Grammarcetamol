'use client';

import {Suspense} from 'react';
import {useParams, useRouter, useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {Skeleton, Tabs, useFetch} from '@grammarcetamol/utilities';
import {OverviewTab} from './OverviewTab';
import {EditTab} from './EditTab';
import {SessionsTab} from './SessionsTab';
import {MaterialsTab} from './MaterialsTab';
import {ChatTab} from './ChatTab';
import {EnrollmentsTab} from './EnrollmentsTab';
import {InvitationsTab} from './InvitationsTab';
import type {LiveClass} from '@/lib/classes.api';

const BASE_TABS = [
  { label: 'Overview', value: 'overview' },
  { label: 'Edit', value: 'edit' },
  { label: 'Sessions', value: 'sessions' },
  { label: 'Materials', value: 'materials' },
  { label: 'Chat', value: 'chat' },
  { label: 'Enrollments', value: 'enrollments' },
];

const INVITATIONS_TAB = { label: 'Invitations', value: 'invitations' };

export default function LiveClassDetailPage() {
  return (
    <Suspense>
      <LiveClassDetailShell />
    </Suspense>
  );
}

function LiveClassDetailShell() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'overview';
  const { data: cls, loading, error, refetch } = useFetch<LiveClass>(`/api/classes/${params.id}`);

  function setTab(tab: string) {
    router.replace(`/live-classes/${params.id}?tab=${tab}`, { scroll: false });
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

  if (error || !cls) {
    return (
      <div className="min-h-screen bg-background p-8 text-center">
        <p className="text-[#64748B] mb-2">Couldn&apos;t load this class.</p>
        <Link href="/live-classes" className="text-accent hover:underline">Back to Live Classes</Link>
      </div>
    );
  }

  const tabs = cls.accessMode === 'INVITE_ONLY' ? [...BASE_TABS, INVITATIONS_TAB] : BASE_TABS;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/live-classes" className="text-sm text-accent hover:underline">← Back to Live Classes</Link>
        <h1 className="text-2xl font-bold text-[#0F172A] mt-3 mb-4">{cls.title}</h1>
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setTab} className="mb-6" />
        {activeTab === 'overview' && <OverviewTab cls={cls} onChanged={refetch} />}
        {activeTab === 'edit' && <EditTab cls={cls} onSaved={refetch} />}
        {activeTab === 'sessions' && <SessionsTab classId={cls.id} />}
        {activeTab === 'materials' && <MaterialsTab classId={cls.id} />}
        {activeTab === 'chat' && <ChatTab cls={cls} onChanged={refetch} />}
        {activeTab === 'enrollments' && <EnrollmentsTab classId={cls.id} />}
        {activeTab === 'invitations' && cls.accessMode === 'INVITE_ONLY' && <InvitationsTab classId={cls.id} />}
      </div>
    </div>
  );
}
