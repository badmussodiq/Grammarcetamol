'use client';

import {useState} from 'react';
import {ApiError, useToast} from '@grammarcetamol/utilities';
import {sha256Hex, uploadsApi} from '@/lib/uploads.api';

type Phase = 'idle' | 'hashing' | 'uploading' | 'finalizing' | 'done' | 'error';

function guessFileType(mimeType: string): string {
  if (mimeType.startsWith('video/')) return 'video';
  return 'resource';
}

/** Chunked upload straight from the browser to object storage (5MB parts, presigned PUT URLs —
 * never proxied through this frontend or any app server), matching backend/upload-service's
 * real multipart-upload flow. On success, hands the resulting upload_files.id up to the caller
 * to attach to the lesson via coursesApi.updateLesson({ uploadFileId }). */
export function LessonFileUpload({
  courseId,
  lessonId,
  accept,
  onUploaded,
}: {
  courseId: string;
  lessonId: string;
  accept?: string;
  onUploaded: (uploadFileId: string) => void;
}) {
  const { addToast } = useToast();
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFileSelected(file: File) {
    setFileName(file.name);
    setPhase('hashing');
    setProgress(0);
    let uploadFileId: string | null = null;

    try {
      const checksum = await sha256Hex(file);

      setPhase('uploading');
      const { data: session } = await uploadsApi.createSession(courseId, [
        {
          lessonId,
          fileName: file.name,
          fileSize: file.size,
          fileType: guessFileType(file.type),
          mimeType: file.type || undefined,
          checksum,
        },
      ]);
      const uploadFile = session.files[0];
      uploadFileId = uploadFile.id;

      let uploadedBytes = 0;
      for (const chunk of uploadFile.chunks) {
        const start = Number(chunk.startByte);
        const end = Number(chunk.endByte);
        const blob = file.slice(start, end + 1);

        const { data: presign } = await uploadsApi.presignChunk(uploadFile.id, chunk.chunkIndex);
        const putRes = await fetch(presign.url, { method: 'PUT', body: blob });
        if (!putRes.ok) {
          throw new Error(`Chunk ${chunk.chunkIndex + 1} failed to upload (status ${putRes.status})`);
        }
        const etag = putRes.headers.get('ETag');
        if (!etag) {
          throw new Error(`Chunk ${chunk.chunkIndex + 1} didn't return an ETag from object storage`);
        }
        await uploadsApi.completeChunk(uploadFile.id, chunk.chunkIndex, etag);

        uploadedBytes += Number(chunk.size);
        setProgress(Math.min(100, Math.round((uploadedBytes / file.size) * 100)));
      }

      setPhase('finalizing');
      await uploadsApi.completeFile(uploadFile.id);

      setPhase('done');
      addToast({ type: 'success', message: `${file.name} uploaded.` });
      onUploaded(uploadFile.id);
    } catch (err) {
      setPhase('error');
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Upload failed';
      addToast({ type: 'error', message });
      if (uploadFileId) {
        uploadsApi.failFile(uploadFileId, message).catch(() => {});
      }
    }
  }

  const busy = phase === 'hashing' || phase === 'uploading' || phase === 'finalizing';

  return (
    <div className="flex items-center gap-3">
      <input
        type="file"
        accept={accept}
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelected(file);
          e.target.value = '';
        }}
        className="text-sm text-[#0F172A] file:mr-3 file:rounded-md file:border-0 file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#0F172A] hover:file:bg-border"
      />
      {phase === 'hashing' && <span className="text-xs text-[#64748B] whitespace-nowrap">Checksumming…</span>}
      {phase === 'uploading' && <span className="text-xs text-[#64748B] whitespace-nowrap">Uploading {fileName} — {progress}%</span>}
      {phase === 'finalizing' && <span className="text-xs text-[#64748B] whitespace-nowrap">Finalizing…</span>}
      {phase === 'done' && <span className="text-xs text-success whitespace-nowrap">Uploaded ✓</span>}
      {phase === 'error' && <span className="text-xs text-error whitespace-nowrap">Upload failed — try again</span>}
    </div>
  );
}
