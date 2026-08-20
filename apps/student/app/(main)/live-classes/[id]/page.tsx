'use client';

import {useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {Skeleton, Tabs, useFetch, useToast} from '@grammarcetamol/utilities';
import {formatScheduleSummary, type MyClassRow} from '@/lib/classes.api';
import {useSessionLiveStatus} from '@/hooks/useSessionLiveStatus';
import {VideoCallOverlay} from '@/components/VideoCallOverlay';
import {SessionStrip} from '@/components/SessionStrip';
import {ChatPanel} from '@/components/ChatPanel';
import {MaterialsPanel} from '@/components/MaterialsPanel';

type PanelTab = 'chat' | 'materials';

export default function ClassroomPage() {
  const params = useParams<{ id: string }>();
  const { addToast } = useToast();

  const { data: myClasses, loading: myClassesLoading } = useFetch<MyClassRow[]>('/api/classes/enrollments/mine');
  const row = myClasses?.find((r) => r.class.id === params.id);
  const hasRealAccess = row?.enrollment.status === 'ACTIVE' || row?.enrollment.status === 'PAUSED';

  const { state: liveState, room } = useSessionLiveStatus(hasRealAccess ? params.id : null, row?.nextSession ?? null);
  const [callOpen, setCallOpen] = useState(false);

  if (myClassesLoading) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="max-w-4xl mx-auto"><Skeleton variant="rect" height={480} /></div>
      </main>
    );
  }

  if (!row) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6 py-10 text-center">
        <div>
          <p className="text-text-primary font-medium mb-2">You don&apos;t have access to this classroom</p>
          <p className="text-text-secondary text-sm mb-4">You need an active enrollment to enter this class.</p>
          <Link href="/live-classes" className="text-primary hover:underline">Browse live classes</Link>
        </div>
      </main>
    );
  }

  if (!hasRealAccess) {
    const reason = row.enrollment.status === 'PENDING_PAYMENT'
      ? 'Your payment for this class is still pending.'
      : 'Your access to this class has ended.';
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6 py-10 text-center">
        <div>
          <p className="text-text-primary font-medium mb-2">{reason}</p>
          <Link href="/live-classes" className="text-primary hover:underline">Back to live classes</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{row.class.title}</h1>
          <p className="text-text-secondary text-sm mt-1">{formatScheduleSummary(row.class.schedules)}</p>
        </div>

        <SessionStrip nextSession={row.nextSession} liveState={liveState} onJoin={() => setCallOpen(true)} />

        <ClassroomTabs classId={row.class.id} chatLocked={row.class.chatLocked} />
      </div>

      {callOpen && room && (
        <VideoCallOverlay
          domain={room.domain}
          roomId={room.roomId}
          onClose={() => {
            setCallOpen(false);
            addToast({ type: 'info', message: 'You left the call.' });
          }}
        />
      )}
    </main>
  );
}

function ClassroomTabs({ classId, chatLocked }: { classId: string; chatLocked: boolean }) {
  const [tab, setTab] = useState<PanelTab>('chat');
  return (
    <div>
      <Tabs
        tabs={[{ label: 'Chat', value: 'chat' }, { label: 'Materials', value: 'materials' }]}
        activeTab={tab}
        onChange={(v) => setTab(v as PanelTab)}
        className="mb-4"
      />
      {tab === 'chat' ? <ChatPanel classId={classId} chatLocked={chatLocked} /> : <MaterialsPanel classId={classId} />}
    </div>
  );
}
