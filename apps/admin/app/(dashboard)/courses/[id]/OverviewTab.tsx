'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, useToast, ApiError } from '@grammarcetamol/utilities';
import { coursesApi, PublishValidationError, type Course, type ModuleResponse } from '../../../../lib/courses.api';

const statusVariant: Record<Course['status'], 'success' | 'warning' | 'neutral' | 'info'> = {
  published: 'success',
  draft: 'neutral',
  review: 'warning',
  archived: 'info',
};

export function OverviewTab({
  course,
  modules,
  onChanged,
}: {
  course: Course;
  modules: ModuleResponse[];
  onChanged: () => void;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState<'publish' | 'archive' | 'delete' | null>(null);

  const lessonCount = modules.reduce((sum, m) => sum + m.lessons.length, 0);

  async function handlePublish() {
    setBusy('publish');
    setPublishErrors([]);
    try {
      await coursesApi.publish(course.id);
      addToast({ type: 'success', message: 'Course published.' });
      onChanged();
    } catch (err) {
      if (err instanceof PublishValidationError) {
        setPublishErrors(err.errors);
      } else {
        addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to publish course' });
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleArchive() {
    setBusy('archive');
    try {
      await coursesApi.archive(course.id);
      addToast({ type: 'success', message: 'Course archived.' });
      onChanged();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to archive course' });
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!confirm('Permanently delete this course? This cannot be undone.')) return;
    setBusy('delete');
    try {
      await coursesApi.delete(course.id);
      addToast({ type: 'success', message: 'Course deleted.' });
      router.push('/courses');
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to delete course' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant={statusVariant[course.status]}>{course.status}</Badge>
            <span className="text-sm text-[#64748B]">v{course.version}</span>
          </div>
          <div className="flex gap-2">
            {(course.status === 'draft' || course.status === 'review') && (
              <Button size="sm" loading={busy === 'publish'} onClick={handlePublish}>Publish</Button>
            )}
            {course.status !== 'archived' && (
              <Button size="sm" variant="secondary" loading={busy === 'archive'} onClick={handleArchive}>Archive</Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              loading={busy === 'delete'}
              disabled={course.enrollmentCount > 0}
              title={course.enrollmentCount > 0 ? 'Cannot delete a course with active enrollments — archive it instead' : undefined}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        </div>

        {publishErrors.length > 0 && (
          <div className="bg-error/10 border border-error rounded-md p-4">
            <p className="text-sm font-medium text-error mb-2">This course isn&apos;t ready to publish:</p>
            <ul className="list-disc list-inside text-sm text-error flex flex-col gap-1">
              {publishErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><dt className="text-[#64748B]">Modules</dt><dd className="text-[#0F172A] font-medium">{modules.length}</dd></div>
          <div><dt className="text-[#64748B]">Lessons</dt><dd className="text-[#0F172A] font-medium">{lessonCount}</dd></div>
          <div><dt className="text-[#64748B]">Students</dt><dd className="text-[#0F172A] font-medium">{course.enrollmentCount}</dd></div>
          <div>
            <dt className="text-[#64748B]">Price</dt>
            <dd className="text-[#0F172A] font-medium">
              {course.price === 0 ? 'Free' : new Intl.NumberFormat('en-US', { style: 'currency', currency: course.currency }).format(course.price)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-surface rounded-lg border border-border p-6">
        <h2 className="font-semibold text-[#0F172A] mb-3">Summary</h2>
        <dl className="flex flex-col gap-3 text-sm">
          <div><dt className="text-[#64748B]">Subtitle</dt><dd className="text-[#0F172A]">{course.subtitle || '—'}</dd></div>
          <div><dt className="text-[#64748B]">Description</dt><dd className="text-[#0F172A] whitespace-pre-line">{course.description}</dd></div>
          <div><dt className="text-[#64748B]">Instructor</dt><dd className="text-[#0F172A]">{course.instructorName}</dd></div>
          <div><dt className="text-[#64748B]">Difficulty</dt><dd className="text-[#0F172A] capitalize">{course.difficulty}</dd></div>
          <div><dt className="text-[#64748B]">Cover image</dt><dd className="text-[#0F172A] break-all">{course.coverImageUrl || '—'}</dd></div>
        </dl>
      </div>
    </div>
  );
}
