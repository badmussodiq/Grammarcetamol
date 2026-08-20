'use client';

import {useEffect, useState} from 'react';
import {Skeleton} from '@grammarcetamol/utilities';
import {classesApi, type ClassMaterial} from '@/lib/classes.api';

const MATERIALS_POLL_INTERVAL_MS = 30000;

export function MaterialsPanel({ classId }: { classId: string }) {
  const [materials, setMaterials] = useState<ClassMaterial[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await classesApi.listMaterials(classId);
        if (!cancelled) setMaterials(data);
      } catch {
        // Non-fatal — materials just stay on last-known state until the next poll succeeds.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const interval = setInterval(load, MATERIALS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [classId]);

  if (loading) return <Skeleton variant="rect" height={200} />;

  if (!materials || materials.length === 0) {
    return <p className="text-text-secondary text-sm py-8 text-center">No materials shared yet.</p>;
  }

  const classLevel = materials.filter((m) => m.sessionId === null);
  const sessionLevel = materials.filter((m) => m.sessionId !== null);

  return (
    <div className="flex flex-col gap-6">
      {classLevel.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-2">Class Materials</h3>
          <MaterialsList materials={classLevel} />
        </div>
      )}
      {sessionLevel.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-2">Session Materials</h3>
          <MaterialsList materials={sessionLevel} />
        </div>
      )}
    </div>
  );
}

function MaterialsList({ materials }: { materials: ClassMaterial[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {materials.map((m) => (
        <li key={m.id}>
          <a
            href={m.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary hover:bg-background transition-colors"
          >
            📄 {m.title}
          </a>
        </li>
      ))}
    </ul>
  );
}
