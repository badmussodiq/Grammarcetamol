'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button, Mapping } from '@grammarcetamol/utilities';
import { useRouter } from 'next/navigation';

const STAT_LABELS = ['Total Students', 'Active Courses', 'Revenue', 'Support Requests'];

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Admin Dashboard</h1>
            <p className="text-[#64748B] mt-1 text-sm">
              Welcome back, <span className="text-primary font-medium">{user?.email ?? 'Admin'}</span>
            </p>
          </div>
          <Button variant="secondary" onClick={handleLogout}>Sign Out</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Mapping array={STAT_LABELS} keyExtractor={(label) => label}>
            {(label) => (
              <div className="bg-surface rounded-lg border border-border p-6 shadow-sm">
                <p className="text-sm text-[#64748B] mb-3">{label}</p>
                <div className="h-7 bg-background rounded animate-pulse" />
              </div>
            )}
          </Mapping>
        </div>
      </div>
    </div>
  );
}
