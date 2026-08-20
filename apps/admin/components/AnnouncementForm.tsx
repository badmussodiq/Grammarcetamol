'use client';

import type {SubmitEvent} from 'react';
import {useEffect, useState} from 'react';
import {Button, Input, Mapping, useGenericState} from '@grammarcetamol/utilities';
import {coursesApi, type Course} from '@/lib/courses.api';
import {
  type AnnouncementFormValues,
  type AnnouncementPriority,
  canEditAnnouncement,
  type AnnouncementStatus,
  validateAnnouncementForm,
} from '@/lib/announcements.api';

const selectClass =
  'rounded-md border border-border px-3 py-2 text-sm text-[#0F172A] bg-white outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40 focus:border-primary';

const PRIORITY_HELP: Record<AnnouncementPriority, string | null> = {
  low: null,
  normal: null,
  high: 'High priority also sends an email to every recipient, not just an in-app notification.',
  critical: 'Critical priority also sends an email to every recipient, not just an in-app notification.',
};

export function AnnouncementForm({
  initialValues,
  onSubmit,
  submitLabel,
  /** Present only in edit mode — governs the read-only guard below. Absent in create mode,
   * where the form is always fully editable. */
  status,
}: {
  initialValues: AnnouncementFormValues;
  onSubmit: (values: AnnouncementFormValues) => Promise<void>;
  submitLabel: string;
  status?: AnnouncementStatus;
}) {
  const [values, updateValue] = useGenericState<AnnouncementFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);

  // `UpdateAnnouncementDto`'s targeting-editable-only-while-draft rule (AnnouncementsService.update)
  // — once scheduled/published/expired, targeting/content can't retroactively change who already
  // got it, so every field here is disabled rather than letting an edit silently fail server-side.
  const readOnly = status !== undefined && !canEditAnnouncement(status);

  useEffect(() => {
    coursesApi.list({ status: 'published' }).then((res) => setCourses(res.data.items)).catch(() => setCourses([]));
  }, []);

  function toggleCourse(id: string) {
    updateValue('targetIds', values.targetIds.includes(id) ? values.targetIds.filter((c) => c !== id) : [...values.targetIds, id]);
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const validationErrors = validateAnnouncementForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {readOnly && (
        <div className="rounded-md border border-border bg-background p-3 text-sm text-[#64748B]">
          This announcement is {status} — its content and targeting can no longer be edited.
        </div>
      )}

      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-[#0F172A]">Content</h2>
        <Input label="Title" value={values.title} onChange={(e) => updateValue('title', e.target.value)} error={errors.title} disabled={readOnly} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[#0F172A]">Body</label>
          <textarea
            value={values.body}
            onChange={(e) => updateValue('body', e.target.value)}
            rows={5}
            disabled={readOnly}
            className={selectClass}
          />
          {errors.body && <p className="text-sm text-error">{errors.body}</p>}
        </div>
      </section>

      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-[#0F172A]">Target Audience</h2>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-[#0F172A]">
            <input type="radio" name="targetType" checked={values.targetType === 'all'} disabled={readOnly} onChange={() => updateValue('targetType', 'all')} />
            All Students
          </label>
          <label className="flex items-center gap-2 text-sm text-[#0F172A]">
            <input type="radio" name="targetType" checked={values.targetType === 'courses'} disabled={readOnly} onChange={() => updateValue('targetType', 'courses')} />
            Specific Courses
          </label>
          <label className="flex items-center gap-2 text-sm text-[#94A3B8] cursor-not-allowed" title="Not backed by any real user-segment concept yet">
            <input type="radio" name="targetType" checked={values.targetType === 'segments'} disabled className="cursor-not-allowed" />
            Specific Segments (coming soon)
          </label>
        </div>

        {values.targetType === 'courses' && (
          <div className="flex flex-col gap-1">
            <div className="max-h-48 overflow-y-auto rounded-md border border-border p-2 flex flex-col gap-1">
              {courses.length === 0 ? (
                <p className="text-sm text-[#94A3B8] p-2">No published courses found.</p>
              ) : (
                <Mapping array={courses} keyExtractor={(c) => c.id}>
                  {(c) => (
                    <label className="flex items-center gap-2 text-sm text-[#0F172A] px-2 py-1 rounded hover:bg-background">
                      <input type="checkbox" checked={values.targetIds.includes(c.id)} disabled={readOnly} onChange={() => toggleCourse(c.id)} />
                      {c.title}
                    </label>
                  )}
                </Mapping>
              )}
            </div>
            {errors.targetIds && <p className="text-sm text-error">{errors.targetIds}</p>}
          </div>
        )}
      </section>

      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-[#0F172A]">Priority</h2>
        <select disabled={readOnly} value={values.priority} onChange={(e) => updateValue('priority', e.target.value as AnnouncementPriority)} className={selectClass}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        {PRIORITY_HELP[values.priority] && <p className="text-sm text-[#64748B]">{PRIORITY_HELP[values.priority]}</p>}
      </section>

      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-[#0F172A]">Scheduling</h2>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-[#0F172A]">
            <input type="radio" name="schedule" checked={values.schedule === 'draft'} disabled={readOnly} onChange={() => updateValue('schedule', 'draft')} />
            Save as Draft
          </label>
          <label className="flex items-center gap-2 text-sm text-[#0F172A]">
            <input type="radio" name="schedule" checked={values.schedule === 'now'} disabled={readOnly} onChange={() => updateValue('schedule', 'now')} />
            Publish Now
          </label>
          <label className="flex items-center gap-2 text-sm text-[#0F172A]">
            <input type="radio" name="schedule" checked={values.schedule === 'later'} disabled={readOnly} onChange={() => updateValue('schedule', 'later')} />
            Schedule for later
          </label>
        </div>
        {values.schedule === 'later' && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[#0F172A]">Publish At</label>
            <input
              type="datetime-local"
              value={values.publishAt}
              disabled={readOnly}
              onChange={(e) => updateValue('publishAt', e.target.value)}
              className={selectClass}
            />
            {errors.publishAt && <p className="text-sm text-error">{errors.publishAt}</p>}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[#0F172A]">Expires At (optional)</label>
          <input
            type="datetime-local"
            value={values.expiresAt}
            disabled={readOnly}
            onChange={(e) => updateValue('expiresAt', e.target.value)}
            className={selectClass}
          />
        </div>
      </section>

      {!readOnly && (
        <Button type="submit" loading={submitting} className="self-start">{submitLabel}</Button>
      )}
    </form>
  );
}
