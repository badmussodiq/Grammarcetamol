'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, useFormState, useToast, ApiError } from '@grammarcetamol/utilities';
import { authApi } from '../../../lib/auth.api';
import type { ChangeEvent, FormEvent } from 'react';

export default function AdminResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';
  const { addToast } = useToast();
  const { values, errors, isSubmitting, setValue, setError, setSubmitting } =
    useFormState({ password: '', confirmPassword: '' });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (values.password.length < 8) { setError('password', 'Password must be at least 8 characters'); return; }
    if (values.password !== values.confirmPassword) { setError('confirmPassword', 'Passwords do not match'); return; }
    if (!token) { addToast({ type: 'error', message: 'Invalid reset link' }); return; }
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, values.password);
      addToast({ type: 'success', message: 'Password reset successfully. Please sign in.' });
      router.push('/login');
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Reset failed' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-[#0F172A] mb-6">Set new password</h2>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input label="New Password" type="password" placeholder="••••••••"
          value={values.password} onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('password', e.target.value)}
          error={errors.password} autoComplete="new-password" />
        <Input label="Confirm Password" type="password" placeholder="••••••••"
          value={values.confirmPassword} onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('confirmPassword', e.target.value)}
          error={errors.confirmPassword} autoComplete="new-password" />
        <Button type="submit" loading={isSubmitting} className="w-full mt-2">Reset Password</Button>
      </form>
      <p className="text-center text-sm text-[#64748B] mt-6">
        <Link href="/login" className="text-accent hover:underline">Back to login</Link>
      </p>
    </>
  );
}
