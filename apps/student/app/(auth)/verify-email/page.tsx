'use client';

import type {ChangeEvent, SubmitEvent} from 'react';
import {Suspense, useEffect} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {ApiError, Button, Input, useFormState, useGenericState, useToast} from '@grammarcetamol/utilities';
import {authApi} from '@/lib/auth.api';

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailFromQuery = searchParams.get('email') ?? '';
  const [cooldown, setCooldown] = useGenericState(0);
  const { addToast } = useToast();
  const { values, errors, isSubmitting, setValue, setError, setSubmitting } =
    useFormState({ email: emailFromQuery, otp: '' });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown, setCooldown]);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!values.email) { setError('email', 'Email is required'); return; }
    if (!/^\d{6}$/.test(values.otp)) { setError('otp', 'Enter the 6-digit code from your email'); return; }
    setSubmitting(true);
    try {
      await authApi.verifyEmail(values.email, values.otp);
      addToast({ type: 'success', message: 'Email verified! You can now sign in.' });
      router.push('/login');
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Verification failed — check the code and try again' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!values.email) { setError('email', 'Enter your email first'); return; }
    setSubmitting(true);
    try {
      await authApi.resendVerification(values.email);
      addToast({ type: 'success', message: 'Verification code resent!' });
      setCooldown(60);
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to resend' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-[#0F172A]">Verify your email</h2>
      <p className="text-[#64748B] text-sm">
        Enter the 6-digit code we emailed you. It expires in 15 minutes.
      </p>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 mt-2">
        <Input label="Email" type="email" placeholder="you@example.com"
          value={values.email} onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('email', e.target.value)}
          error={errors.email} autoComplete="email" />
        <Input label="6-digit code" type="text" inputMode="numeric" placeholder="123456" maxLength={6}
          value={values.otp} onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('otp', e.target.value.replace(/\D/g, ''))}
          error={errors.otp} autoComplete="one-time-code" />
        <Button type="submit" loading={isSubmitting} className="w-full">Verify Email</Button>
      </form>
      <Button variant="ghost" loading={isSubmitting} disabled={cooldown > 0} onClick={handleResend} className="w-full">
        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
      </Button>
      <p className="text-center text-sm text-[#64748B]">
        <Link href="/login" className="text-primary hover:underline">Back to login</Link>
      </p>
    </div>
  );
}
