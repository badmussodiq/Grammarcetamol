'use client';

import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {ApiError, Button, Input, useFormState, useToast} from '@grammarcetamol/utilities';
import {useAuth} from '@/contexts/AuthContext';
import type {ChangeEvent, SubmitEvent} from 'react';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { addToast } = useToast();
  const { values, errors, isSubmitting, setValue, setError, setSubmitting } =
    useFormState({ email: '', password: '' });

  function validate(): boolean {
    let ok = true;
    if (!values.email) { setError('email', 'Email is required'); ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      setError('email', 'Enter a valid email'); ok = false;
    }
    if (!values.password) { setError('password', 'Password is required'); ok = false; }
    return ok;
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await login(values.email, values.password);
      router.push('/dashboard');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Login failed';
      addToast({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-[#0F172A] mb-1">Admin Sign In</h2>
      <p className="text-sm text-[#64748B] mb-6">Access is restricted to authorized personnel only.</p>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          placeholder="admin@example.com"
          value={values.email}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('email', e.target.value)}
          error={errors.email}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={values.password}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('password', e.target.value)}
          error={errors.password}
          autoComplete="current-password"
        />
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-accent hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={isSubmitting} className="w-full mt-2">
          Sign In
        </Button>
      </form>
    </>
  );
}
