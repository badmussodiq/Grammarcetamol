'use client';

import { useRouter } from 'next/navigation';
import { Dropdown } from '@grammarcetamol/utilities';
import { useAuth } from '@/contexts/AuthContext';
import { Breadcrumb } from './Breadcrumb';

export function TopHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  const displayName = user?.fullName ?? user?.email ?? 'Admin';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-surface flex-shrink-0 sticky top-0 z-10">
      <Breadcrumb />
      <Dropdown
        align="right"
        trigger={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold">
              {initial}
            </div>
            <span className="text-sm text-text-primary hidden sm:block">{displayName}</span>
          </div>
        }
        items={[{ label: 'Logout', onClick: () => void handleLogout(), destructive: true }]}
      />
    </header>
  );
}
