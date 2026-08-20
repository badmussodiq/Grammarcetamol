'use client';

import {ApiError, useToast} from '@grammarcetamol/utilities';
import {ClassForm} from '@/components/ClassForm';
import {type ClassFormValues, classesApi, classToFormValues, type LiveClass} from '@/lib/classes.api';

export function EditTab({ cls, onSaved }: { cls: LiveClass; onSaved: () => void }) {
  const { addToast } = useToast();

  async function handleSubmit(values: ClassFormValues) {
    try {
      await classesApi.update(cls.id, values);
      addToast({ type: 'success', message: 'Class updated' });
      onSaved();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to update class' });
    }
  }

  return (
    <div className="mt-6 max-w-2xl">
      <ClassForm initialValues={classToFormValues(cls)} onSubmit={handleSubmit} submitLabel="Save Changes" mode="edit" classId={cls.id} />
    </div>
  );
}
