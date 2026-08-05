'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, Mapping, useToast, useFormState, useGenericState, ApiError } from '@grammarcetamol/utilities';
import { authApi } from '../../../lib/auth.api';
import type { ChangeEvent, FormEvent } from 'react';

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: '', color: '#E2E8F0' },
    { label: 'Weak', color: '#EF4444' },
    { label: 'Fair', color: '#F59E0B' },
    { label: 'Good', color: '#3B82F6' },
    { label: 'Strong', color: '#10B981' },
  ];
  return { score, ...map[score] };
}

export default function RegisterPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [agreed, setAgreed] = useGenericState(false);
  const { values, errors, isSubmitting, setValue, setError, setSubmitting } =
    useFormState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const strength = getPasswordStrength(values.password);

  function validate(): boolean {
    let ok = true;
    if (!values.fullName.trim()) { setError('fullName', 'Full name is required'); ok = false; }
    if (!values.email) { setError('email', 'Email is required'); ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      setError('email', 'Enter a valid email'); ok = false;
    }
    if (values.password.length < 8) { setError('password', 'Password must be at least 8 characters'); ok = false; }
    if (values.password !== values.confirmPassword) { setError('confirmPassword', 'Passwords do not match'); ok = false; }
    if (!agreed) { addToast({ type: 'warning', message: 'Please accept the terms and conditions' }); ok = false; }
    return ok;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await authApi.register({ email: values.email, password: values.password, fullName: values.fullName });
      addToast({ type: 'success', message: 'Account created! Please check your email to verify.' });
      router.push('/login');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Registration failed';
      addToast({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-[#0F172A] mb-6">Create your account</h2>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input label="Full Name" placeholder="Jane Doe" value={values.fullName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('fullName', e.target.value)} error={errors.fullName} />
        <Input label="Email" type="email" placeholder="you@example.com" value={values.email}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('email', e.target.value)} error={errors.email} autoComplete="email" />
        <div className="flex flex-col gap-1">
          <Input label="Password" type="password" placeholder="••••••••" value={values.password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('password', e.target.value)} error={errors.password} autoComplete="new-password" />
          {values.password && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex gap-1 flex-1">
                <Mapping array={[1, 2, 3, 4]} keyExtractor={(i) => i}>
                  {(i) => (
                    <div className="h-1 flex-1 rounded-full transition-colors duration-200"
                      style={{ backgroundColor: i <= strength.score ? strength.color : '#E2E8F0' }} />
                  )}
                </Mapping>
              </div>
              <span className="text-xs" style={{ color: strength.color }}>{strength.label}</span>
            </div>
          )}
        </div>
        <Input label="Confirm Password" type="password" placeholder="••••••••" value={values.confirmPassword}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('confirmPassword', e.target.value)} error={errors.confirmPassword} autoComplete="new-password" />
        <label className="flex items-start gap-2 text-sm text-[#64748B] cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 accent-[#1E3A5F]" />
          I agree to the <Link href="/terms" className="text-primary hover:underline">Terms &amp; Conditions</Link>
        </label>
        <Button type="submit" loading={isSubmitting} className="w-full mt-2">Create Account</Button>
      </form>
      <p className="text-center text-sm text-[#64748B] mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
      </p>
    </>
  );
}
