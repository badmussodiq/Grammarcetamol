'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Input, Button, Mapping, useFetch, useGenericState } from '@grammarcetamol/utilities';
import { validateCourseForm, type Category, type CourseFormValues } from '../lib/courses.api';

const selectClass =
  'rounded-md border border-border px-3 py-2 text-sm text-[#0F172A] bg-white outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40 focus:border-primary';

export function CourseForm({
  initialValues,
  onSubmit,
  submitLabel,
}: {
  initialValues: CourseFormValues;
  onSubmit: (values: CourseFormValues) => Promise<void>;
  submitLabel: string;
}) {
  const { data: categories } = useFetch<Category[]>('/api/categories');
  const [values, updateValue] = useGenericState<CourseFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [objectiveInput, setObjectiveInput] = useState('');

  function addObjective() {
    if (!objectiveInput.trim()) return;
    updateValue('learningObjectives', [...values.learningObjectives, objectiveInput.trim()]);
    setObjectiveInput('');
  }

  function removeObjective(index: number) {
    updateValue('learningObjectives', values.learningObjectives.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const validationErrors = validateCourseForm(values);
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
      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-[#0F172A]">Course Info</h2>
        <Input label="Title" value={values.title} onChange={(e) => updateValue('title', e.target.value)} error={errors.title} />
        <Input label="Subtitle" value={values.subtitle} onChange={(e) => updateValue('subtitle', e.target.value)} />

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

        <div>
          <label className="text-sm font-medium text-[#0F172A]">Learning Objectives</label>
          <div className="flex gap-2 mt-1">
            <Input
              value={objectiveInput}
              onChange={(e) => setObjectiveInput(e.target.value)}
              placeholder="Add an objective..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addObjective(); }
              }}
            />
            <Button type="button" variant="secondary" onClick={addObjective}>Add</Button>
          </div>
          {values.learningObjectives.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              <Mapping array={values.learningObjectives} keyExtractor={(_, i) => i}>
                {(objective, i) => (
                  <span className="inline-flex items-center gap-1.5 bg-background border border-border rounded-full px-3 py-1 text-xs text-[#0F172A]">
                    {objective}
                    <button type="button" onClick={() => removeObjective(i)} className="text-[#94A3B8] hover:text-error" aria-label={`Remove ${objective}`}>
                      ×
                    </button>
                  </span>
                )}
              </Mapping>
            </div>
          )}
        </div>

        <Input label="Target Audience" value={values.targetAudience} onChange={(e) => updateValue('targetAudience', e.target.value)} />
        <Input label="Prerequisites" value={values.prerequisites} onChange={(e) => updateValue('prerequisites', e.target.value)} />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[#0F172A]">Category</label>
            <select value={values.categoryId} onChange={(e) => updateValue('categoryId', e.target.value)} className={selectClass}>
              <option value="">No category</option>
              <Mapping array={categories ?? []} keyExtractor={(c) => c.id}>
                {(c) => <option value={c.id}>{c.name}</option>}
              </Mapping>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[#0F172A]">Difficulty</label>
            <select
              value={values.difficulty}
              onChange={(e) => updateValue('difficulty', e.target.value as CourseFormValues['difficulty'])}
              className={selectClass}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Language" value={values.language} onChange={(e) => updateValue('language', e.target.value)} />
          <Input
            label="Estimated Duration (minutes)"
            type="number"
            min="0"
            value={values.estimatedDuration}
            onChange={(e) => updateValue('estimatedDuration', e.target.value)}
          />
        </div>

        <Input label="Cover Image URL" value={values.coverImageUrl} onChange={(e) => updateValue('coverImageUrl', e.target.value)} />
        <Input label="Promo Video URL" value={values.promoVideoUrl} onChange={(e) => updateValue('promoVideoUrl', e.target.value)} />

        <Input
          label="Instructor Name"
          value={values.instructorName}
          onChange={(e) => updateValue('instructorName', e.target.value)}
          error={errors.instructorName}
        />
        <Input label="Instructor Bio" value={values.instructorBio} onChange={(e) => updateValue('instructorBio', e.target.value)} />
        <Input label="Instructor Avatar URL" value={values.instructorAvatarUrl} onChange={(e) => updateValue('instructorAvatarUrl', e.target.value)} />
      </section>

      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-[#0F172A]">Pricing</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Price"
            type="number"
            min="0"
            step="0.01"
            value={values.price}
            onChange={(e) => updateValue('price', e.target.value)}
            error={errors.price}
            helperText="0 for a free course"
          />
          <Input
            label="Discount Price (optional)"
            type="number"
            min="0"
            step="0.01"
            value={values.discountPrice}
            onChange={(e) => updateValue('discountPrice', e.target.value)}
            error={errors.discountPrice}
          />
        </div>
        <Input label="Currency" value={values.currency} onChange={(e) => updateValue('currency', e.target.value)} />
      </section>

      <Button type="submit" loading={submitting} className="self-start">{submitLabel}</Button>
    </form>
  );
}
