'use client';

import {useState} from 'react';
import {ApiError, Button, Input, Mapping, useFetch, useToast} from '@grammarcetamol/utilities';
import {classesApi, type ClassMaterial, type LiveSession} from '@/lib/classes.api';

export function MaterialsTab({ classId }: { classId: string }) {
  const { addToast } = useToast();
  const { data: materials, loading, refetch } = useFetch<ClassMaterial[]>(`/api/classes/${classId}/materials`);
  const { data: sessions } = useFetch<LiveSession[]>(`/api/classes/${classId}/sessions`);
  const [title, setTitle] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd() {
    if (!title.trim() || !fileUrl.trim()) {
      addToast({ type: 'error', message: 'Add a title and a file URL' });
      return;
    }
    setSubmitting(true);
    try {
      await classesApi.createMaterial(classId, { title: title.trim(), fileUrl: fileUrl.trim(), sessionId: sessionId || undefined });
      addToast({ type: 'success', message: 'Material added' });
      setTitle('');
      setFileUrl('');
      setSessionId('');
      refetch();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not add material' });
    } finally {
      setSubmitting(false);
    }
  }

  const classLevel = (materials ?? []).filter((m) => m.sessionId === null);
  const sessionLevel = (materials ?? []).filter((m) => m.sessionId !== null);

  return (
    <div className="flex flex-col gap-6 mt-6">
      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-[#0F172A]">Add Material</h2>
        <p className="text-xs text-[#94A3B8]">
          Paste a link to an already-hosted file — same as a course&apos;s cover image field, not a direct upload here.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input label="File URL" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[#0F172A]">Visibility</label>
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm text-[#0F172A] bg-white outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40"
          >
            <option value="">Class-level (always visible)</option>
            <Mapping array={sessions ?? []} keyExtractor={(s) => s.id}>
              {(s) => <option value={s.id}>Session-specific — {new Date(s.startTime).toLocaleDateString()}</option>}
            </Mapping>
          </select>
        </div>
        <Button loading={submitting} onClick={handleAdd} className="self-start">Add Material</Button>
      </section>

      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-[#0F172A]">Materials</h2>
        {loading ? (
          <p className="text-sm text-[#64748B]">Loading…</p>
        ) : (materials ?? []).length === 0 ? (
          <p className="text-sm text-[#64748B]">No materials shared yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {classLevel.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A] mb-2">Class-Level</h3>
                <MaterialsList materials={classLevel} />
              </div>
            )}
            {sessionLevel.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A] mb-2">Session-Specific</h3>
                <MaterialsList materials={sessionLevel} />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function MaterialsList({ materials }: { materials: ClassMaterial[] }) {
  return (
    <ul className="flex flex-col gap-2">
      <Mapping array={materials} keyExtractor={(m) => m.id}>
        {(m) => (
          <li>
            <a href={m.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-[#0F172A] hover:bg-background">
              📄 {m.title}
            </a>
          </li>
        )}
      </Mapping>
    </ul>
  );
}
