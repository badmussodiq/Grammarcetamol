'use client';

import type {ChangeEvent, FormEvent} from 'react';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {ApiError, Button, Input, useFormState} from '@grammarcetamol/utilities';
import {useAuth} from '@/contexts/AuthContext';
import {supportApi} from '@/lib/support.api';

export default function SupportPage() {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const { values, errors, isSubmitting, setValue, setError, setSubmitting } =
    useFormState({ name: '', email: '', subject: '', message: '' });

  useEffect(() => {
    if (!user) return;
    setValue('name', user.fullName ?? '');
    setValue('email', user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function validate(): boolean {
    let ok = true;
    if (!values.name.trim()) { setError('name', 'Name is required'); ok = false; }
    if (!values.email) { setError('email', 'Email is required'); ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) { setError('email', 'Enter a valid email'); ok = false; }
    if (!values.subject.trim()) { setError('subject', 'Subject is required'); ok = false; }
    if (!values.message.trim()) { setError('message', 'Message is required'); ok = false; }
    return ok;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await supportApi.submit(values);
      setSubmitted(true);
    } catch (err) {
      setError('message', err instanceof ApiError ? err.message : 'Failed to submit — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-2">We&apos;ve got your message</h1>
          <p className="text-text-secondary mb-6">
            Check your email for a confirmation — our team will follow up there directly.
          </p>
          <Link href="/" className="text-primary hover:underline">Back to home</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Need help?</h1>
        <p className="text-text-secondary mb-6">
          Send us an enquiry and we&apos;ll get back to you by email.
        </p>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Input label="Name" placeholder="Jane Doe" value={values.name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('name', e.target.value)} error={errors.name} />
          <Input label="Email" type="email" placeholder="you@example.com" value={values.email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('email', e.target.value)} error={errors.email} />
          <Input label="Subject" placeholder="What's this about?" value={values.subject}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('subject', e.target.value)} error={errors.subject} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-primary">Message</label>
            <textarea
              value={values.message}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setValue('message', e.target.value)}
              rows={6}
              placeholder="Tell us what's going on…"
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40"
            />
            {errors.message && <span className="text-sm text-error">{errors.message}</span>}
          </div>
          <Button type="submit" loading={isSubmitting} className="w-full mt-2">Send message</Button>
        </form>
      </div>
    </main>
  );
}
