'use client';

import type {ChangeEvent, FormEvent} from 'react';
import {Suspense} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {ApiError, Button, Input, useFormState, useToast} from '@grammarcetamol/utilities';
import {authApi} from '@/lib/auth.api';

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
  const emailFromQuery = searchParams.get('email') ?? '';
  const { addToast } = useToast();
  const { values, errors, isSubmitting, setValue, setError, setSubmitting } =
    useFormState({ email: emailFromQuery, otp: '', password: '', confirmPassword: '' });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!values.email) { setError('email', 'Email is required'); return; }
    if (!/^\d{6}$/.test(values.otp)) { setError('otp', 'Enter the 6-digit code from your email'); return; }
    if (values.password.length < 8) { setError('password', 'Password must be at least 8 characters'); return; }
    if (values.password !== values.confirmPassword) { setError('confirmPassword', 'Passwords do not match'); return; }
    setSubmitting(true);
    try {
      await authApi.resetPassword(values.email, values.otp, values.password);
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
      <h2 className="text-xl font-semibold text-[#0F172A] mb-2">Set new password</h2>
      <p className="text-[#64748B] text-sm mb-6">Enter the 6-digit code we emailed you, along with your new password.</p>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input label="Email" type="email" placeholder="admin@example.com"
          value={values.email} onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('email', e.target.value)}
          error={errors.email} autoComplete="email" />
        <Input label="6-digit code" type="text" inputMode="numeric" placeholder="123456" maxLength={6}
          value={values.otp} onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('otp', e.target.value.replace(/\D/g, ''))}
          error={errors.otp} autoComplete="one-time-code" />
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
