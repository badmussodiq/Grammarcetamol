'use client';

import type {ChangeEvent, SubmitEvent} from 'react';
import {useEffect, useState} from 'react';
import {ApiError, Button, Input, Skeleton, Tabs, useFetch, useFormState, useToast} from '@grammarcetamol/utilities';
import {useAuth} from '@/contexts/AuthContext';
import {parseLearningGoals, profileApi, type UserProfile} from '@/lib/profile.api';
import {notificationsApi, type PreferenceType, type Preferences} from '@/lib/notifications.api';

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

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
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

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
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

const PREFERENCE_TYPE_LABELS: Record<PreferenceType, string> = {
  course: 'Course updates',
  payment: 'Payments',
  live_class: 'Live classes',
  announcement: 'Announcements',
};

const PREFERENCE_TYPES = Object.keys(PREFERENCE_TYPE_LABELS) as PreferenceType[];

function NotificationsTab() {
  const { addToast } = useToast();
  const { data: preferences, loading } = useFetch<Preferences>('/api/notification-preferences');
  const [local, setLocal] = useState<Preferences | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (preferences) setLocal(preferences);
  }, [preferences]);

  async function toggle(type: PreferenceType, channel: 'inApp' | 'email') {
    if (!local) return;
    const previous = local;
    const nextChannelValue = !local[type][channel];
    const nextPrefs: Preferences = { ...local, [type]: { ...local[type], [channel]: nextChannelValue } };
    setLocal(nextPrefs);
    setSavingKey(`${type}-${channel}`);
    try {
      await notificationsApi.updatePreferences({ [type]: nextPrefs[type] });
    } catch (err) {
      setLocal(previous);
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not update preference' });
    } finally {
      setSavingKey(null);
    }
  }

  if (loading || !local) {
    return (
      <div className="flex flex-col gap-3 mt-6 max-w-lg">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rect" height={44} />)}
      </div>
    );
  }

  return (
    <div className="mt-6 max-w-lg">
      <p className="text-sm text-text-secondary mb-4">
        Choose how you want to hear about each type of update. System notifications (like account
        security alerts) always stay on.
      </p>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_80px] items-center px-4 py-2 bg-background text-xs font-semibold text-text-secondary uppercase">
          <span>Type</span>
          <span className="text-center">In-App</span>
          <span className="text-center">Email</span>
        </div>
        {PREFERENCE_TYPES.map((type) => (
          <div key={type} className="grid grid-cols-[1fr_80px_80px] items-center px-4 py-3 border-t border-border">
            <span className="text-sm text-text-primary">{PREFERENCE_TYPE_LABELS[type]}</span>
            {(['inApp', 'email'] as const).map((channel) => (
              <span key={channel} className="flex justify-center">
                <input
                  type="checkbox"
                  aria-label={`${PREFERENCE_TYPE_LABELS[type]} — ${channel === 'inApp' ? 'in-app' : 'email'}`}
                  checked={local[type][channel]}
                  disabled={savingKey === `${type}-${channel}`}
                  onChange={() => toggle(type, channel)}
                  className="w-4 h-4 accent-primary cursor-pointer disabled:opacity-50"
                />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
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
          tabs={[
            { label: 'Profile', value: 'profile' },
            { label: 'Account', value: 'account' },
            { label: 'Notifications', value: 'notifications' },
          ]}
          activeTab={tab}
          onChange={setTab}
        />
        {tab === 'profile' ? <ProfileTab /> : tab === 'account' ? <AccountTab /> : <NotificationsTab />}
      </div>
    </main>
  );
}
