'use client';

import { useToast, ApiError } from '@grammarcetamol/utilities';
import { CourseForm } from '../../../../components/CourseForm';
import { coursesApi, courseToFormValues, type Course, type CourseFormValues } from '../../../../lib/courses.api';

export function EditTab({ course, onSaved }: { course: Course; onSaved: () => void }) {
  const { addToast } = useToast();

  async function handleSubmit(values: CourseFormValues) {
    try {
      await coursesApi.update(course.id, values);
      addToast({ type: 'success', message: 'Course updated.' });
      onSaved();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to update course' });
    }
  }

  return <CourseForm initialValues={courseToFormValues(course)} onSubmit={handleSubmit} submitLabel="Save Changes" />;
}
