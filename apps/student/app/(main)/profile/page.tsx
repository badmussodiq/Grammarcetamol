'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Button, Input, Skeleton, Tabs, useFormState, useFetch, useToast, ApiError } from '@grammarcetamol/utilities';
import { useAuth } from '@/contexts/AuthContext';
import { profileApi, parseLearningGoals, type UserProfile } from '@/lib/profile.api';

function ProfileTab() {
  const { refreshUser } = useAuth();
  const { addToast } = useToast();
  const { data: profile, loading, refetch } = useFetch<UserProfile>('/api/users/me');
  const { values, errors, isSubmitting, setValue, setError, setSubmitting } = useFormState({
    fullName: '',
    phone: '',
    country: '',
    timezone: '',
    bio: '',
    avatarUrl: '',
    learningGoals: '',
  });
  const [initial, setInitial] = useState<typeof values | null>(null);

  useEffect(() => {
    if (!profile) return;
    const next = {
      fullName: profile.fullName ?? '',
      phone: profile.phone ?? '',
      country: profile.country ?? '',
      timezone: profile.timezone ?? '',
      bio: profile.bio ?? '',
      avatarUrl: profile.avatarUrl ?? '',
      learningGoals: (profile.learningGoals ?? []).join(', '),
    };
    setInitial(next);
    (Object.keys(next) as (keyof typeof next)[]).forEach((key) => setValue(key, next[key]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const isDirty = initial ? (Object.keys(initial) as (keyof typeof initial)[]).some((key) => initial[key] !== values[key]) : false;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!values.fullName.trim()) { setError('fullName', 'Full name is required'); return; }
    setSubmitting(true);
    try {
      await profileApi.updateMe({
        fullName: values.fullName,
        phone: values.phone,
        country: values.country,
        timezone: values.timezone,
        bio: values.bio,
        avatarUrl: values.avatarUrl,
        learningGoals: parseLearningGoals(values.learningGoals),
      });
      await refreshUser();
      await refetch();
      addToast({ type: 'success', message: 'Profile updated' });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to update profile' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !profile) {
    return (
      <div className="flex flex-col gap-4 mt-6">
        {[0, 1, 2].map((i) => <Skeleton key={i} variant="rect" height={44} />)}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 mt-6 max-w-lg">
      <Input label="Full name" value={values.fullName} error={errors.fullName}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('fullName', e.target.value)} />
      <Input label="Email" value={profile.email} disabled helperText="Email cannot be changed" />
      <Input label="Phone" value={values.phone}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('phone', e.target.value)} />
      <Input label="Country" value={values.country}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('country', e.target.value)} />
      <Input label="Timezone" value={values.timezone} placeholder="e.g. Africa/Lagos"
        onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('timezone', e.target.value)} />
      <Input label="Avatar URL" value={values.avatarUrl} placeholder="https://…"
        helperText="Paste a link to a hosted image"
        onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('avatarUrl', e.target.value)} />
      <Input label="Learning goals" value={values.learningGoals} placeholder="e.g. IELTS, Business English"
        helperText="Comma-separated"
        onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('learningGoals', e.target.value)} />
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-text-primary">Bio</label>
        <textarea
          value={values.bio}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setValue('bio', e.target.value)}
          rows={4}
          maxLength={500}
          className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40"
        />
      </div>
      <Button type="submit" loading={isSubmitting} disabled={!isDirty} className="w-fit">
        Save Changes
      </Button>
    </form>
  );
}

function AccountTab() {
  const { addToast } = useToast();
  const { values, errors, isSubmitting, setValue, setError, setSubmitting, reset } = useFormState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  function validate(): boolean {
    let ok = true;
    if (!values.currentPassword) { setError('currentPassword', 'Current password is required'); ok = false; }
    if (values.newPassword.length < 8) { setError('newPassword', 'New password must be at least 8 characters'); ok = false; }
    if (values.newPassword !== values.confirmPassword) { setError('confirmPassword', 'Passwords do not match'); ok = false; }
    return ok;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await profileApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      addToast({ type: 'success', message: 'Password updated' });
      reset();
    } catch (err) {
      setError('currentPassword', err instanceof ApiError ? err.message : 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 mt-6 max-w-md">
      <Input label="Current password" type="password" value={values.currentPassword} error={errors.currentPassword}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('currentPassword', e.target.value)} />
      <Input label="New password" type="password" value={values.newPassword} error={errors.newPassword}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('newPassword', e.target.value)} />
      <Input label="Confirm new password" type="password" value={values.confirmPassword} error={errors.confirmPassword}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('confirmPassword', e.target.value)} />
      <Button type="submit" loading={isSubmitting} className="w-fit">Change Password</Button>
    </form>
  );
}

export default function ProfilePage() {
  const [tab, setTab] = useState('profile');

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Profile</h1>
        <p className="text-text-secondary mb-6">Manage your personal information and account security.</p>
        <Tabs
          tabs={[{ label: 'Profile', value: 'profile' }, { label: 'Account', value: 'account' }]}
          activeTab={tab}
          onChange={setTab}
        />
        {tab === 'profile' ? <ProfileTab /> : <AccountTab />}
      </div>
    </main>
  );
}
