'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ApiError, useToast} from '@grammarcetamol/utilities';
import {CourseForm} from '@/components/CourseForm';
import {type CourseFormValues, coursesApi, EMPTY_COURSE_FORM} from '@/lib/courses.api';

export default function CreateCoursePage() {
  const router = useRouter();
  const { addToast } = useToast();

  async function handleSubmit(values: CourseFormValues) {
    try {
      const res = await coursesApi.create(values);
      addToast({ type: 'success', message: `"${values.title}" was created as a draft.` });
      router.push(`/courses/${res.data.id}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to create course';
      addToast({ type: 'error', message: msg });
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/courses" className="text-sm text-accent hover:underline">← Back to Courses</Link>
        <h1 className="text-2xl font-bold text-[#0F172A] mt-3 mb-1">Create Course</h1>
        <p className="text-[#64748B] text-sm mb-6">
          Saved as a draft — add modules and lessons on the next page before publishing.
        </p>
        <CourseForm initialValues={EMPTY_COURSE_FORM} onSubmit={handleSubmit} submitLabel="Create Draft" />
      </div>
    </div>
  );
}
