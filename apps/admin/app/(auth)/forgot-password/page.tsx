'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, Input, useFormState, useGenericState, useToast, ApiError } from '@grammarcetamol/utilities';
import { authApi } from '../../../lib/auth.api';
import type { ChangeEvent, FormEvent } from 'react';

export default function AdminForgotPasswordPage() {
  const [{ sent, cooldown }, updateFlow] = useGenericState({ sent: false, cooldown: 0 });
  const { addToast } = useToast();
  const { values, errors, isSubmitting, setValue, setError, setSubmitting } =
    useFormState({ email: '' });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => updateFlow('cooldown', (c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown, updateFlow]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!values.email) { setError('email', 'Email is required'); return; }
    setSubmitting(true);
    try {
      await authApi.forgotPassword(values.email);
      updateFlow('sent', true);
      updateFlow('cooldown', 60);
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Request failed' });
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-[#E0F2FE] flex items-center justify-center">
        <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#0369A1" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-[#0F172A]">Check your inbox</h2>
      <p className="text-[#64748B] text-sm">If that email exists in our system, a reset link was sent.</p>
      <Button variant="ghost" disabled={cooldown > 0} onClick={() => updateFlow('sent', false)} className="mt-2">
        {cooldown > 0 ? `Try again in ${cooldown}s` : 'Try a different email'}
      </Button>
      <Link href="/login" className="text-sm text-accent hover:underline">Back to login</Link>
    </div>
  );

  return (
    <>
      <h2 className="text-xl font-semibold text-[#0F172A] mb-2">Reset your password</h2>
      <p className="text-[#64748B] text-sm mb-6">Enter your admin email to receive a reset link.</p>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input label="Email" type="email" placeholder="admin@example.com"
          value={values.email} onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('email', e.target.value)}
          error={errors.email} autoComplete="email" />
        <Button type="submit" loading={isSubmitting} className="w-full">Send Reset Link</Button>
      </form>
      <p className="text-center text-sm text-[#64748B] mt-6">
            <Link href="/login" className="text-sm text-accent hover:underline">Back to login</Link>
      </p>
    </>
  );
}
