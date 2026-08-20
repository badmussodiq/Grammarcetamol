'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ApiError, useToast} from '@grammarcetamol/utilities';
import {ClassForm} from '@/components/ClassForm';
import {type ClassFormValues, classesApi, EMPTY_CLASS_FORM} from '@/lib/classes.api';

export default function CreateClassPage() {
  const router = useRouter();
  const { addToast } = useToast();

  async function handleSubmit(values: ClassFormValues) {
    try {
      const res = await classesApi.create(values);
      addToast({ type: 'success', message: `"${values.title}" was created as a draft.` });
      router.push(`/live-classes/${res.data.id}`);
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to create class' });
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/live-classes" className="text-sm text-accent hover:underline">← Back to Live Classes</Link>
        <h1 className="text-2xl font-bold text-[#0F172A] mt-3 mb-1">Schedule a Live Class</h1>
        <p className="text-[#64748B] text-sm mb-6">
          Saved as a draft — publish it from the class detail page once you&apos;re ready for students to see it.
        </p>
        <ClassForm initialValues={EMPTY_CLASS_FORM} onSubmit={handleSubmit} submitLabel="Create Draft" />
      </div>
    </div>
  );
}
