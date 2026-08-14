'use client';

import {useEffect, useState} from 'react';
import {ApiError, Button, Skeleton, useFetch, useToast} from '@grammarcetamol/utilities';
import {profileApi, type UserProfile} from '@/lib/profile.api';

const PREFERENCE_TOGGLES: { key: string; label: string; description: string }[] = [
  { key: 'courseUpdates', label: 'Course updates', description: 'New lessons and content added to courses you\'re enrolled in.' },
  { key: 'paymentConfirmations', label: 'Payment confirmations', description: 'Receipts and confirmations for purchases you make.' },
  { key: 'marketingEmails', label: 'Marketing emails', description: 'Occasional news, offers, and product updates.' },
  { key: 'newCourseReleases', label: 'New course releases', description: 'Be the first to know when a new course launches.' },
];

export default function SettingsPage() {
  const { addToast } = useToast();
  const { data: profile, loading, refetch } = useFetch<UserProfile>('/api/users/me');
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const defaults: Record<string, boolean> = {};
    for (const toggle of PREFERENCE_TOGGLES) {
      const stored = profile.preferences?.[toggle.key];
      defaults[toggle.key] = typeof stored === 'boolean' ? stored : true;
    }
    setPrefs(defaults);
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    try {
      await profileApi.updateMe({ preferences: prefs });
      await refetch();
      addToast({ type: 'success', message: 'Settings saved' });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Settings</h1>
        <p className="text-text-secondary mb-6">Choose which notifications you&apos;d like to receive.</p>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rect" height={64} />)}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {PREFERENCE_TOGGLES.map((toggle) => (
              <label
                key={toggle.key}
                className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={prefs[toggle.key] ?? true}
                  onChange={(e) => setPrefs((prev) => ({ ...prev, [toggle.key]: e.target.checked }))}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-text-primary">{toggle.label}</span>
                  <span className="block text-sm text-text-secondary">{toggle.description}</span>
                </span>
              </label>
            ))}
            <Button onClick={handleSave} loading={saving} className="w-fit mt-2">
              Save Settings
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
