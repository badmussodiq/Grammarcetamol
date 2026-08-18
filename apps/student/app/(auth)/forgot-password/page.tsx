'use client';

import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {ApiError, Button, Input, useFormState, useToast} from '@grammarcetamol/utilities';
import {authApi} from '@/lib/auth.api';
import type {ChangeEvent, SubmitEvent} from 'react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { values, errors, isSubmitting, setValue, setError, setSubmitting } =
    useFormState({ email: '' });

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!values.email) { setError('email', 'Email is required'); return; }
    setSubmitting(true);
    try {
      await authApi.forgotPassword(values.email);
      // A 6-digit code, not a clickable link, so there's no email to "click through" — take
      // the student straight to the code-entry form instead of a static "check your inbox"
      // dead end, pre-filling the email they just typed.
      router.push(`/reset-password?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Request failed' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-[#0F172A] mb-2">Forgot your password?</h2>
      <p className="text-[#64748B] text-sm mb-6">Enter your email and we&apos;ll send you a 6-digit reset code.</p>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input label="Email" type="email" placeholder="you@example.com"
          value={values.email} onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('email', e.target.value)}
          error={errors.email} autoComplete="email" />
        <Button type="submit" loading={isSubmitting} className="w-full">Send Reset Code</Button>
      </form>
      <p className="text-center text-sm text-[#64748B] mt-6">
        <Link href="/login" className="text-primary hover:underline">Back to login</Link>
      </p>
    </>
  );
}
