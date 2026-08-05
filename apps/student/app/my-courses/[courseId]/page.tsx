'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useFetch, useToast, Skeleton, Button, cn, ApiError } from '@grammarcetamol/utilities';
import { enrollmentApi, findDefaultLesson } from '@/lib/enrollment.api';
import type { LearnLesson, LearnModule, LearnResponse } from '@/lib/enrollment.api';

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// A lesson counts as "watched" once the player crosses this fraction of its duration — matches
// how streaming platforms typically avoid requiring the literal final frame for credit.
const COMPLETION_WATCH_FRACTION = 0.9;
const PROGRESS_SYNC_INTERVAL_MS = 5000;

function flattenLessons(modules: LearnModule[]): LearnLesson[] {
  return modules.flatMap((m) => m.lessons);
}

export default function LearningInterfacePage() {
  const params = useParams<{ courseId: string }>();
  const { addToast } = useToast();
  const { data, loading, error, refetch } = useFetch<LearnResponse>(`/api/enrollments/course/${params.courseId}/learn`);

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSyncedAtRef = useRef(0);

  useEffect(() => {
    if (data && selectedLessonId === null) {
      setSelectedLessonId(findDefaultLesson(data.modules)?.id ?? null);
    }
  }, [data, selectedLessonId]);

  const allLessons = useMemo(() => (data ? flattenLessons(data.modules) : []), [data]);
  const selectedLesson = allLessons.find((l) => l.id === selectedLessonId) ?? null;
  const selectedIndex = allLessons.findIndex((l) => l.id === selectedLessonId);
  const prevLesson = selectedIndex > 0 ? allLessons[selectedIndex - 1] : null;
  const nextLesson = selectedIndex >= 0 && selectedIndex < allLessons.length - 1 ? allLessons[selectedIndex + 1] : null;
  const canOpenNext = nextLesson != null && nextLesson.state !== 'locked';

  useEffect(() => {
    lastSyncedAtRef.current = 0;
    if (videoRef.current && selectedLesson) {
      videoRef.current.currentTime = selectedLesson.watchPosition;
    }
  }, [selectedLesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function syncProgress(currentTime: number, completed: boolean) {
    if (!selectedLesson || !data) return;
    enrollmentApi.updateProgress(data.courseId, selectedLesson.id, Math.floor(currentTime), completed).catch(() => {});
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video || !selectedLesson) return;
    const now = Date.now();
    if (now - lastSyncedAtRef.current < PROGRESS_SYNC_INTERVAL_MS) return;
    lastSyncedAtRef.current = now;
    const completed = video.duration > 0 && video.currentTime / video.duration >= COMPLETION_WATCH_FRACTION;
    syncProgress(video.currentTime, completed);
  }

  async function handleEnded() {
    if (!selectedLesson) return;
    await handleMarkComplete();
  }

  async function handleMarkComplete() {
    if (!selectedLesson || !data) return;
    try {
      await enrollmentApi.updateProgress(data.courseId, selectedLesson.id, Math.floor(videoRef.current?.currentTime ?? 0), true);
      await refetch();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not update progress' });
    }
  }

  function openLesson(lesson: LearnLesson) {
    if (lesson.state === 'locked') {
      addToast({ type: 'info', message: 'Complete the previous lesson to unlock this one' });
      return;
    }
    setSelectedLessonId(lesson.id);
    setSidebarOpen(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <Skeleton variant="rect" height={480} />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6 py-10 text-center">
        <div>
          <p className="text-text-primary font-medium mb-2">You&apos;re not enrolled in this course</p>
          <Link href="/my-courses" className="text-primary hover:underline">Back to My Courses</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile sidebar toggle */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <p className="font-semibold text-text-primary truncate">{data.courseTitle}</p>
        <Button size="sm" variant="secondary" onClick={() => setSidebarOpen((v) => !v)}>
          {sidebarOpen ? 'Close' : 'Lessons'}
        </Button>
      </div>

      <aside className={cn(
        'md:w-80 md:flex-shrink-0 border-r border-border bg-surface md:sticky md:top-0 md:h-screen md:overflow-y-auto',
        sidebarOpen ? 'block' : 'hidden md:block',
      )}>
        <div className="p-4 border-b border-border hidden md:block">
          <p className="font-semibold text-text-primary">{data.courseTitle}</p>
          <p className="text-sm text-text-secondary mt-1">{data.completionPct}% complete</p>
        </div>
        {data.modules.map((module) => (
          <div key={module.id} className="border-b border-border">
            <p className="px-4 py-2 text-xs font-semibold uppercase text-text-muted bg-background">{module.title}</p>
            <ul>
              {module.lessons.map((lesson) => {
                const isSelected = lesson.id === selectedLessonId;
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      onClick={() => openLesson(lesson)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors',
                        isSelected ? 'bg-primary/10 border-l-4 border-primary' : 'border-l-4 border-transparent hover:bg-background',
                        lesson.state === 'locked' && 'text-text-muted',
                      )}
                    >
                      <span className={cn(
                        lesson.state === 'completed' && 'text-success',
                        lesson.state === 'current' && 'text-primary',
                        lesson.state === 'locked' && 'text-text-muted',
                      )}>
                        {lesson.state === 'completed' ? <CheckIcon /> : lesson.state === 'locked' ? <LockIcon /> : <PlayIcon />}
                      </span>
                      <span className={cn('flex-1', isSelected && 'font-medium text-text-primary')}>{lesson.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </aside>

      <div className="flex-1 flex flex-col gap-6 px-4 md:px-8 py-6 max-w-4xl">
        {selectedLesson ? (
          <>
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              {selectedLesson.videoUrl ? (
                <video
                  ref={videoRef}
                  key={selectedLesson.id}
                  src={selectedLesson.videoUrl}
                  controls
                  className="w-full h-full"
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleEnded}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/60 text-sm">
                  No video for this lesson yet
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-xl font-semibold text-text-primary">{selectedLesson.title}</h1>
                <Button
                  variant={selectedLesson.state === 'completed' ? 'secondary' : 'primary'}
                  onClick={handleMarkComplete}
                  disabled={selectedLesson.state === 'completed'}
                >
                  {selectedLesson.state === 'completed' ? 'Completed ✓' : 'Mark Complete'}
                </Button>
              </div>

              {data.completionPct >= 50 && (
                <Link href={`/courses`} className="text-sm text-primary hover:underline w-fit">
                  Leave a Review
                </Link>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Button
                  variant="secondary"
                  disabled={!prevLesson}
                  onClick={() => prevLesson && openLesson(prevLesson)}
                >
                  ← Previous Lesson
                </Button>
                <Button
                  variant="secondary"
                  disabled={!nextLesson || !canOpenNext}
                  onClick={() => nextLesson && openLesson(nextLesson)}
                >
                  Next Lesson →
                </Button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-text-secondary">This course doesn&apos;t have any lessons yet.</p>
        )}
      </div>
    </main>
  );
}
