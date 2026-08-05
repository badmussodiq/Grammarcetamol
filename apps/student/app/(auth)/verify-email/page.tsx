'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Spinner, useFormState, useGenericState, useToast, ApiError } from '@grammarcetamol/utilities';
import { authApi } from '../../../lib/auth.api';
import type { FormEvent } from 'react';

type Status = 'loading' | 'success' | 'expired' | 'no-token';

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [{ status, cooldown }, updateFlow] = useGenericState({
    status: (token ? 'loading' : 'no-token') as Status,
    cooldown: 0,
  });
  const { values, setValue, isSubmitting, setSubmitting } = useFormState({ email: '' });
  const { addToast } = useToast();

  useEffect(() => {
    if (!token) return;
    authApi.verifyEmail(token)
      .then(() => updateFlow('status', 'success'))
      .catch(() => updateFlow('status', 'expired'));
  }, [token, updateFlow]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => updateFlow('cooldown', (c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown, updateFlow]);

  async function handleResend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!values.email) return;
    setSubmitting(true);
    try {
      await authApi.resendVerification(values.email);
      addToast({ type: 'success', message: 'Verification email sent!' });
      updateFlow('cooldown', 60);
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to resend' });
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading') return (
    <div className="flex flex-col items-center gap-4 py-4">
      <Spinner size="lg" color="#1E3A5F" />
      <p className="text-[#64748B]">Verifying your email...</p>
    </div>
  );

  if (status === 'success') return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-[#D1FAE5] flex items-center justify-center">
        <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#065F46" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-[#0F172A]">Email Verified!</h2>
      <p className="text-[#64748B]">Your account is active. You can now sign in.</p>
      <Link href="/login"><Button className="mt-2">Go to Login</Button></Link>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-[#0F172A]">
        {status === 'no-token' ? 'Verify Your Email' : 'Link Expired'}
      </h2>
      <p className="text-[#64748B] text-sm">
        {status === 'no-token'
          ? 'Enter your email below to resend the verification link.'
          : 'Your verification link has expired. Enter your email to get a new one.'}
      </p>
      <form onSubmit={handleResend} className="flex flex-col gap-3 mt-2">
        <input type="email" placeholder="you@example.com" value={values.email}
          onChange={(e) => setValue('email', e.target.value)} required
          className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
        <Button type="submit" loading={isSubmitting} disabled={cooldown > 0} className="w-full">
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Verification Email'}
        </Button>
      </form>
      <p className="text-center text-sm text-[#64748B]">
        <Link href="/login" className="text-primary hover:underline">Back to login</Link>
      </p>
    </div>
  );
}
