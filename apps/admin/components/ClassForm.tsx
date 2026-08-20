'use client';

import type {SubmitEvent} from 'react';
import {useEffect, useState} from 'react';
import {Button, Input, Mapping, useGenericState} from '@grammarcetamol/utilities';
import {
  type ClassFormValues,
  type ClassSchedule,
  classesApi,
  findScheduleConflicts,
  instructorsApi,
  type InstructorOption,
  validateClassForm,
} from '@/lib/classes.api';

const selectClass =
  'rounded-md border border-border px-3 py-2 text-sm text-[#0F172A] bg-white outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40 focus:border-primary';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const AVAILABILITY_WINDOW_DAYS = 28;
const CONFLICT_CHECK_DEBOUNCE_MS = 400;

function newScheduleRow(): ClassSchedule {
  return {
    dayOfWeek: 1,
    startTime: '15:00',
    endTime: '16:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    effectiveFrom: new Date().toISOString(),
    effectiveUntil: null,
  };
}

export function ClassForm({
  initialValues,
  onSubmit,
  submitLabel,
  mode = 'create',
  classId,
}: {
  initialValues: ClassFormValues;
  /** 'edit' disables classType/accessMode/paymentModel/instructorId/videoProvider — `PATCH
   * /api/classes/:id` (UpdateClassDto) doesn't accept any of these, so leaving them editable
   * here would silently do nothing on save, exactly the "config that accepts a change but
   * doesn't apply it" pattern this project avoids elsewhere (Task 43's own platform-selector
   * note). Changing any of these after creation isn't supported by the domain model at all —
   * not a gap to fix here, since e.g. changing FREE to RECURRING after students have already
   * enrolled has no defined billing-migration behavior. */
  mode?: 'create' | 'edit';
  /** The class being edited, so the conflict check can exclude its own already-scheduled
   * sessions — otherwise every edit of a class with a recurring schedule would flag a
   * self-conflict against itself and permanently block Save. Unused in create mode. */
  classId?: string;
  onSubmit: (values: ClassFormValues) => Promise<void>;
  submitLabel: string;
}) {
  // Fetched manually (not via useFetch) — instructorsApi.list() merges two role-filtered
  // GET /api/users calls into one option list, not a single GET this hook could wrap directly.
  const [instructorOptions, setInstructorOptions] = useState<InstructorOption[]>([]);
  const [values, updateValue] = useGenericState<ClassFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [conflicts, setConflicts] = useState<ClassSchedule[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  useEffect(() => {
    instructorsApi.list().then(setInstructorOptions).catch(() => setInstructorOptions([]));
  }, []);

  // Real-time conflict check — debounced, re-runs whenever the instructor or schedule rows
  // change. A UI hint only (see findScheduleConflicts' own comment); submit is still blocked
  // on it per PLAN.md's own "blocks submit on overlap" requirement.
  useEffect(() => {
    if (!values.instructorId || values.schedules.length === 0) {
      setConflicts([]);
      return;
    }
    const handle = setTimeout(() => {
      setCheckingConflicts(true);
      const from = new Date().toISOString();
      const to = new Date(Date.now() + AVAILABILITY_WINDOW_DAYS * 24 * 60 * 60_000).toISOString();
      classesApi.instructorAvailability(values.instructorId, from, to, classId)
        .then(({ data: busy }) => setConflicts(findScheduleConflicts(values.schedules, busy)))
        .catch(() => setConflicts([]))
        .finally(() => setCheckingConflicts(false));
    }, CONFLICT_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.instructorId, values.schedules, classId]);

  function addScheduleRow() {
    updateValue('schedules', [...values.schedules, newScheduleRow()]);
  }

  function updateScheduleRow(index: number, patch: Partial<ClassSchedule>) {
    updateValue('schedules', values.schedules.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeScheduleRow(index: number) {
    updateValue('schedules', values.schedules.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const validationErrors = validateClassForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    if (conflicts.length > 0) return;
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-[#0F172A]">Class Info</h2>
        <Input label="Title" value={values.title} onChange={(e) => updateValue('title', e.target.value)} error={errors.title} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[#0F172A]">Description</label>
          <textarea
            value={values.description}
            onChange={(e) => updateValue('description', e.target.value)}
            rows={4}
            className={selectClass}
          />
          {errors.description && <p className="text-sm text-error">{errors.description}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[#0F172A]">Class Type</label>
            <select disabled={mode === 'edit'} value={values.classType} onChange={(e) => updateValue('classType', e.target.value as ClassFormValues['classType'])} className={selectClass}>
              <option value="GROUP">Group</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[#0F172A]">Access Mode</label>
            <select disabled={mode === 'edit'} value={values.accessMode} onChange={(e) => updateValue('accessMode', e.target.value as ClassFormValues['accessMode'])} className={selectClass}>
              <option value="OPEN">Open (self-enroll)</option>
              <option value="INVITE_ONLY">Invite-only</option>
            </select>
          </div>
        </div>
        {mode === 'edit' && (
          <p className="text-xs text-[#94A3B8] -mt-2">
            Class type, access mode, payment model, instructor, and video platform can&apos;t be changed after creation.
          </p>
        )}

        {values.classType === 'GROUP' && (
          <Input
            label="Capacity (optional)"
            type="number"
            min="1"
            value={values.capacity}
            onChange={(e) => updateValue('capacity', e.target.value)}
            error={errors.capacity}
            helperText="Leave blank for unlimited"
          />
        )}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[#0F172A]">Instructor</label>
          <select disabled={mode === 'edit'} value={values.instructorId} onChange={(e) => updateValue('instructorId', e.target.value)} className={selectClass}>
            <option value="">Select an instructor…</option>
            <Mapping array={instructorOptions} keyExtractor={(i) => i.id}>
              {(i) => <option value={i.id}>{i.fullName ?? i.email}</option>}
            </Mapping>
          </select>
          {errors.instructorId && <p className="text-sm text-error">{errors.instructorId}</p>}
        </div>

        <Input label="Cover Image URL" value={values.coverImageUrl} onChange={(e) => updateValue('coverImageUrl', e.target.value)} />
      </section>

      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[#0F172A]">Recurring Schedule</h2>
          <Button type="button" variant="secondary" size="sm" onClick={addScheduleRow}>+ Add a time slot</Button>
        </div>
        <p className="text-sm text-[#64748B]">
          Each row generates real weekly sessions on the calendar — this is not a single date/time picker.
        </p>

        {values.schedules.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No recurring schedule yet — add sessions manually from the class detail page instead, or add a time slot above.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <Mapping array={values.schedules} keyExtractor={(_, i) => i}>
              {(row, i) => {
                const hasConflict = conflicts.includes(row);
                return (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-md border ${hasConflict ? 'border-error bg-error/5' : 'border-border'}`}>
                    <select value={row.dayOfWeek} onChange={(e) => updateScheduleRow(i, { dayOfWeek: Number(e.target.value) })} className={selectClass}>
                      <Mapping array={DAY_LABELS} keyExtractor={(_, di) => di}>
                        {(label, di) => <option value={di}>{label}</option>}
                      </Mapping>
                    </select>
                    <input type="time" value={row.startTime} onChange={(e) => updateScheduleRow(i, { startTime: e.target.value })} className={selectClass} />
                    <span className="text-[#64748B]">to</span>
                    <input type="time" value={row.endTime} onChange={(e) => updateScheduleRow(i, { endTime: e.target.value })} className={selectClass} />
                    <span className="text-xs text-[#94A3B8] flex-1">{row.timezone}</span>
                    <button type="button" onClick={() => removeScheduleRow(i)} className="text-[#94A3B8] hover:text-error" aria-label="Remove time slot">×</button>
                  </div>
                );
              }}
            </Mapping>
          </div>
        )}

        {checkingConflicts && <p className="text-sm text-[#64748B]">Checking instructor availability…</p>}
        {conflicts.length > 0 && (
          <div className="rounded-md border border-error bg-error/5 p-3 text-sm text-error">
            This instructor already has a conflicting session at {conflicts.length === 1 ? 'this time' : 'these times'} — adjust the schedule before saving.
          </div>
        )}
      </section>

      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-[#0F172A]">Pricing</h2>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[#0F172A]">Payment Model</label>
          <select disabled={mode === 'edit'} value={values.paymentModel} onChange={(e) => updateValue('paymentModel', e.target.value as ClassFormValues['paymentModel'])} className={selectClass}>
            <option value="FREE">Free</option>
            <option value="ONE_TIME">One-time</option>
            <option value="RECURRING">Recurring (subscription)</option>
          </select>
          {mode === 'edit' && <p className="text-xs text-[#94A3B8]">The price and billing interval below can still be adjusted.</p>}
        </div>

        {values.paymentModel !== 'FREE' && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={values.classType === 'PRIVATE' ? 'Negotiated Price' : 'Price'}
              type="number"
              min="0"
              step="0.01"
              value={values.defaultPrice}
              onChange={(e) => updateValue('defaultPrice', e.target.value)}
              error={errors.defaultPrice}
              helperText={values.classType === 'PRIVATE' ? 'Starting point — can be overridden per invitation' : undefined}
            />
            <Input label="Currency" value={values.currency} onChange={(e) => updateValue('currency', e.target.value)} />
          </div>
        )}

        {values.paymentModel === 'RECURRING' && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[#0F172A]">Billing Interval</label>
            <select value={values.billingInterval} onChange={(e) => updateValue('billingInterval', e.target.value)} className={selectClass}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="biannually">Biannually</option>
              <option value="annually">Annually</option>
            </select>
            {errors.billingInterval && <p className="text-sm text-error">{errors.billingInterval}</p>}
          </div>
        )}
      </section>

      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-[#0F172A]">Video Platform</h2>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[#0F172A]">Meeting Platform</label>
          <select disabled={mode === 'edit'} value={values.videoProvider} onChange={(e) => updateValue('videoProvider', e.target.value)} className={selectClass}>
            <option value="jitsi">Jitsi Meet</option>
            <option value="zoom" disabled>Zoom (coming soon)</option>
            <option value="google_meet" disabled>Google Meet (coming soon)</option>
          </select>
        </div>
        <Input
          label="Materials Retention (days)"
          type="number"
          min="1"
          value={values.materialsRetentionDays}
          onChange={(e) => updateValue('materialsRetentionDays', e.target.value)}
          helperText="How long after the class ends materials stay visible to students"
        />
      </section>

      <Button type="submit" loading={submitting} disabled={conflicts.length > 0} className="self-start">{submitLabel}</Button>
    </form>
  );
}
