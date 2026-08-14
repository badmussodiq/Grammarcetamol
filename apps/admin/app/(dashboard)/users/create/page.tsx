'use client';

import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {ApiError, Button, Input, Mapping, useFormState, useToast} from '@grammarcetamol/utilities';
import {usersApi} from '../../../../lib/users.api';
import type {ChangeEvent, FormEvent} from 'react';

const ROLES = [
  { value: 'MODERATOR', label: 'Moderator' },
  { value: 'CUSTOMER_SUPPORT', label: 'Customer Support' },
] as const;

export default function CreateUserPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { values, errors, isSubmitting, setValue, setError, setSubmitting } =
    useFormState({ email: '', password: '', fullName: '', role: 'MODERATOR' });

  function validate(): boolean {
    let ok = true;
    if (!values.fullName.trim()) { setError('fullName', 'Full name is required'); ok = false; }
    if (!values.email) { setError('email', 'Email is required'); ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      setError('email', 'Enter a valid email'); ok = false;
    }
    if (values.password.length < 8) { setError('password', 'Must be at least 8 characters'); ok = false; }
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(values.password)) {
      setError('password', 'Must contain an upper case letter, a lower case letter, and a number'); ok = false;
    }
    return ok;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await usersApi.create({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        role: values.role as 'MODERATOR' | 'CUSTOMER_SUPPORT',
      });
      const roleLabel = ROLES.find((r) => r.value === values.role)?.label ?? values.role;
      addToast({ type: 'success', message: `${values.fullName} was created as ${roleLabel}.` });
      router.push('/users');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to create user';
      addToast({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-lg mx-auto">
        <Link href="/users" className="text-sm text-accent hover:underline">← Back to Users</Link>
        <h1 className="text-2xl font-bold text-[#0F172A] mt-3 mb-1">Create Staff Account</h1>
        <p className="text-[#64748B] text-sm mb-6">
          Moderators and customer support accounts are created here — students self-register.
        </p>

        <form onSubmit={handleSubmit} noValidate className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
          <Input
            label="Full Name"
            placeholder="Jane Doe"
            value={values.fullName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('fullName', e.target.value)}
            error={errors.fullName}
          />
          <Input
            label="Email"
            type="email"
            placeholder="jane@example.com"
            value={values.email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('email', e.target.value)}
            error={errors.email}
            autoComplete="email"
          />
          <Input
            label="Temporary Password"
            type="password"
            placeholder="••••••••"
            value={values.password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('password', e.target.value)}
            error={errors.password}
            helperText="At least 8 characters, with upper case, lower case, and a number."
            autoComplete="new-password"
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="role" className="text-sm font-medium text-[#0F172A]">Role</label>
            <select
              id="role"
              value={values.role}
              onChange={(e) => setValue('role', e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm text-[#0F172A] bg-white outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40 focus:border-primary"
            >
              <Mapping array={ROLES} keyExtractor={(r) => r.value}>
                {(r) => <option value={r.value}>{r.label}</option>}
              </Mapping>
            </select>
          </div>
          <Button type="submit" loading={isSubmitting} className="w-full mt-2">
            Create Account
          </Button>
        </form>
      </div>
    </div>
  );
}
