'use client';

import {useState} from 'react';
import {ApiError, Badge, Button, Input, useToast} from '@grammarcetamol/utilities';
import {coursesApi, type LessonResponse, type ModuleResponse} from '@/lib/courses.api';
import {LessonFileUpload} from './LessonFileUpload';

function swap<T>(items: T[], i: number, j: number): T[] {
  const next = [...items];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function ContentTab({
  courseId,
  modules,
  onChanged,
}: {
  courseId: string;
  modules: ModuleResponse[];
  onChanged: () => void;
}) {
  const { addToast } = useToast();
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [addingModule, setAddingModule] = useState(false);

  function reportError(err: unknown, fallback: string) {
    addToast({ type: 'error', message: err instanceof ApiError ? err.message : fallback });
  }

  async function addModule() {
    if (!newModuleTitle.trim()) return;
    setAddingModule(true);
    try {
      await coursesApi.createModule(courseId, { title: newModuleTitle.trim() });
      setNewModuleTitle('');
      onChanged();
    } catch (err) {
      reportError(err, 'Failed to add module');
    } finally {
      setAddingModule(false);
    }
  }

  async function moveModule(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= modules.length) return;
    try {
      await coursesApi.reorderModules(courseId, swap(modules.map((m) => m.id), index, target));
      onChanged();
    } catch (err) {
      reportError(err, 'Failed to reorder modules');
    }
  }

  async function deleteModule(moduleId: string) {
    if (!confirm('Delete this module and all its lessons?')) return;
    try {
      await coursesApi.deleteModule(courseId, moduleId);
      onChanged();
    } catch (err) {
      reportError(err, 'Failed to delete module');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {modules.length === 0 && (
        <p className="text-sm text-[#64748B]">No modules yet — add the first one below.</p>
      )}

      {modules.map((module, i) => (
        <ModuleCard
          key={module.id}
          courseId={courseId}
          module={module}
          index={i}
          total={modules.length}
          onMoveUp={() => moveModule(i, -1)}
          onMoveDown={() => moveModule(i, 1)}
          onDelete={() => deleteModule(module.id)}
          onChanged={onChanged}
        />
      ))}

      <div className="bg-surface rounded-lg border border-dashed border-border p-4 flex gap-2">
        <Input
          placeholder="New module title..."
          value={newModuleTitle}
          onChange={(e) => setNewModuleTitle(e.target.value)}
          className="flex-1"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addModule(); } }}
        />
        <Button variant="secondary" loading={addingModule} onClick={addModule}>+ Add Module</Button>
      </div>
    </div>
  );
}

function ModuleCard({
  courseId,
  module,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onDelete,
  onChanged,
}: {
  courseId: string;
  module: ModuleResponse;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const { addToast } = useToast();
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [addingLesson, setAddingLesson] = useState(false);

  function reportError(err: unknown, fallback: string) {
    addToast({ type: 'error', message: err instanceof ApiError ? err.message : fallback });
  }

  async function addLesson() {
    if (!newLessonTitle.trim()) return;
    setAddingLesson(true);
    try {
      await coursesApi.createLesson(courseId, module.id, { title: newLessonTitle.trim(), type: 'video' });
      setNewLessonTitle('');
      onChanged();
    } catch (err) {
      reportError(err, 'Failed to add lesson');
    } finally {
      setAddingLesson(false);
    }
  }

  async function moveLesson(i: number, direction: -1 | 1) {
    const target = i + direction;
    if (target < 0 || target >= module.lessons.length) return;
    try {
      await coursesApi.reorderLessons(courseId, module.id, swap(module.lessons.map((l) => l.id), i, target));
      onChanged();
    } catch (err) {
      reportError(err, 'Failed to reorder lessons');
    }
  }

  async function deleteLesson(lessonId: string) {
    try {
      await coursesApi.deleteLesson(courseId, module.id, lessonId);
      onChanged();
    } catch (err) {
      reportError(err, 'Failed to delete lesson');
    }
  }

  async function togglePreview(lesson: LessonResponse) {
    try {
      await coursesApi.updateLesson(courseId, module.id, lesson.id, { preview: !lesson.preview });
      onChanged();
    } catch (err) {
      reportError(err, 'Failed to update lesson');
    }
  }

  async function saveLessonVideo(lesson: LessonResponse, videoUrl: string, duration: string) {
    try {
      await coursesApi.updateLesson(courseId, module.id, lesson.id, {
        videoUrl: videoUrl.trim() || undefined,
        duration: duration ? Number(duration) : undefined,
      });
      onChanged();
    } catch (err) {
      reportError(err, 'Failed to update lesson');
    }
  }

  async function attachUploadedFile(lesson: LessonResponse, uploadFileId: string) {
    try {
      await coursesApi.updateLesson(courseId, module.id, lesson.id, { uploadFileId });
      onChanged();
    } catch (err) {
      reportError(err, 'File uploaded, but failed to attach it to the lesson');
    }
  }

  async function toggleAllowDownload(lesson: LessonResponse) {
    try {
      await coursesApi.updateLesson(courseId, module.id, lesson.id, { allowDownload: !lesson.allowDownload });
      onChanged();
    } catch (err) {
      reportError(err, 'Failed to update lesson');
    }
  }

  return (
    <div className="bg-surface rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border">
        <span className="font-medium text-[#0F172A]">{index + 1}. {module.title}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onMoveUp} disabled={index === 0} className="px-2 py-1 text-[#64748B] hover:text-[#0F172A] disabled:opacity-30" aria-label="Move module up">↑</button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1} className="px-2 py-1 text-[#64748B] hover:text-[#0F172A] disabled:opacity-30" aria-label="Move module down">↓</button>
          <Button variant="ghost" size="sm" onClick={onDelete}>Delete</Button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {module.lessons.length === 0 && <p className="text-sm text-[#64748B]">No lessons yet.</p>}

        {module.lessons.map((lesson, li) => (
          <LessonRow
            key={lesson.id}
            courseId={courseId}
            lesson={lesson}
            isFirst={li === 0}
            isLast={li === module.lessons.length - 1}
            onMoveUp={() => moveLesson(li, -1)}
            onMoveDown={() => moveLesson(li, 1)}
            onDelete={() => deleteLesson(lesson.id)}
            onTogglePreview={() => togglePreview(lesson)}
            onSaveVideo={(url, duration) => saveLessonVideo(lesson, url, duration)}
            onFileUploaded={(uploadFileId) => attachUploadedFile(lesson, uploadFileId)}
            onToggleAllowDownload={() => toggleAllowDownload(lesson)}
          />
        ))}

        <div className="flex gap-2 pt-1">
          <Input
            placeholder="New lesson title..."
            value={newLessonTitle}
            onChange={(e) => setNewLessonTitle(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLesson(); } }}
          />
          <Button size="sm" variant="secondary" loading={addingLesson} onClick={addLesson}>+ Add Lesson</Button>
        </div>
      </div>
    </div>
  );
}

function LessonRow({
  courseId,
  lesson,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  onTogglePreview,
  onSaveVideo,
  onFileUploaded,
  onToggleAllowDownload,
}: {
  courseId: string;
  lesson: LessonResponse;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onTogglePreview: () => void;
  onSaveVideo: (videoUrl: string, duration: string) => Promise<void>;
  onFileUploaded: (uploadFileId: string) => void;
  onToggleAllowDownload: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl ?? '');
  const [duration, setDuration] = useState(lesson.duration != null ? String(lesson.duration) : '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSaveVideo(videoUrl, duration);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-b border-border/60 last:border-0 pb-2 last:pb-0">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-[#0F172A]">{lesson.title}</span>
          {lesson.preview && <Badge variant="info" size="sm">Preview</Badge>}
          {lesson.uploadFileId && <Badge variant="success" size="sm">File uploaded</Badge>}
          {!lesson.uploadFileId && !lesson.videoUrl && (
            <Badge variant="warning" size="sm">{lesson.type === 'video' ? 'Missing video' : 'No file attached'}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onMoveUp} disabled={isFirst} className="px-1.5 text-[#64748B] hover:text-[#0F172A] disabled:opacity-30" aria-label="Move lesson up">↑</button>
          <button type="button" onClick={onMoveDown} disabled={isLast} className="px-1.5 text-[#64748B] hover:text-[#0F172A] disabled:opacity-30" aria-label="Move lesson down">↓</button>
          <Button variant="ghost" size="sm" onClick={onTogglePreview}>{lesson.preview ? 'Unmark preview' : 'Mark preview'}</Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>{editing ? 'Cancel' : 'Edit'}</Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>Delete</Button>
        </div>
      </div>
      {editing && (
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex gap-2 items-end">
            <Input label="Video URL (external link)" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="flex-1" />
            <Input label="Duration (seconds)" type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-40" />
            <Button size="sm" loading={saving} onClick={handleSave}>Save</Button>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">
              Or upload a file (video, image, or PDF) — takes priority over the external link above
            </label>
            <LessonFileUpload
              courseId={courseId}
              lessonId={lesson.id}
              accept="video/*,image/*,application/pdf"
              onUploaded={onFileUploaded}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#0F172A] w-fit cursor-pointer">
            <input type="checkbox" checked={lesson.allowDownload} onChange={onToggleAllowDownload} />
            Allow students to download/open this file directly
          </label>
          <p className="text-xs text-[#64748B] -mt-2">
            Off by default — students can always view the file inline (video player, image, or PDF preview) either way.
          </p>
        </div>
      )}
    </div>
  );
}
