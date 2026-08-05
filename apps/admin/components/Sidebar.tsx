'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@grammarcetamol/utilities';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  label: string;
  href: string;
  superAdminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Only groups/items with a real page behind them — admin-frontend.md's full sketch also has
// Insights/Communication/System groups, but nothing backs those yet (no analytics/notification
// services, no settings pages), so they're left out rather than shown empty.
const NAV_GROUPS: NavGroup[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', href: '/dashboard' }] },
  { label: 'Education', items: [{ label: 'Courses', href: '/courses' }] },
  { label: 'People', items: [
    { label: 'Users', href: '/users' },
    { label: 'Students', href: '/students' },
  ] },
  { label: 'Business', items: [
    { label: 'Revenue', href: '/revenue', superAdminOnly: true },
    { label: 'Transactions', href: '/transactions' },
  ] },
  { label: 'Feedback', items: [{ label: 'Reviews', href: '/reviews' }] },
];

const STORAGE_KEY = 'admin-sidebar-collapsed';

export function Sidebar() {
  const pathname = usePathname() ?? '';
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === 'true');
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  const roles = user?.roles.split(',').map((r) => r.trim()) ?? [];
  const isSuperAdmin = roles.includes('SUPER_ADMIN');

  return (
    <aside className={cn(
      // sticky + h-screen (not just flex-stretch off a min-h-screen ancestor) — existing pages
      // each carry their own min-h-screen wrapper, which combined with TopHeader's height would
      // otherwise inflate the whole layout past 100vh and scroll the sidebar's own bottom
      // (the collapse toggle) out of view along with everything else.
      'bg-sidebar flex-shrink-0 flex flex-col transition-all duration-200 sticky top-0 h-screen',
      collapsed ? 'w-16' : 'w-64',
    )}>
      <div className="h-16 flex items-center px-4 border-b border-white/10 overflow-hidden">
        <span className="font-bold text-white whitespace-nowrap">{collapsed ? 'G' : 'Grammarcetamol'}</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => !item.superAdminOnly || isSuperAdmin);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label} className="mb-4">
              {!collapsed && (
                <p className="px-4 mb-1 text-xs font-semibold uppercase tracking-wide text-white/40">{group.label}</p>
              )}
              {visibleItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center px-4 py-2.5 text-sm transition-colors truncate',
                      active ? 'bg-sidebar-active text-white font-medium' : 'text-sidebar-text hover:bg-white/5',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={toggleCollapsed}
        className="px-4 py-3 text-xs text-white/50 hover:text-white border-t border-white/10 text-left"
      >
        {collapsed ? '→' : '← Collapse'}
      </button>
    </aside>
  );
}
