'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import {useEffect, useState} from 'react';
import {cn} from '@grammarcetamol/utilities';
import {useAuth} from '@/contexts/AuthContext';

function iconProps() {
  return {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

const DashboardIcon = () => (
  <svg {...iconProps()}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>
);
const CoursesIcon = () => (
  <svg {...iconProps()}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
);
const UsersIcon = () => (
  <svg {...iconProps()}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);
const StudentsIcon = () => (
  <svg {...iconProps()}><path d="M22 10 12 4 2 10l10 6 10-6Z" /><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" /></svg>
);
const RevenueIcon = () => (
  <svg {...iconProps()}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
);
const TransactionsIcon = () => (
  <svg {...iconProps()}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M7 14h4" /></svg>
);
const ReviewsIcon = () => (
  <svg {...iconProps()}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
);
const SupportIcon = () => (
  <svg {...iconProps()}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
);

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  superAdminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Only groups/items with a real page behind them — admin-frontend.md's full sketch also has
// a System group, but nothing backs that yet (no settings pages), so it's left out rather than
// shown empty.
const NAV_GROUPS: NavGroup[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', href: '/dashboard', icon: <DashboardIcon /> }] },
  { label: 'Education', items: [{ label: 'Courses', href: '/courses', icon: <CoursesIcon /> }] },
  { label: 'People', items: [
    { label: 'Users', href: '/users', icon: <UsersIcon /> },
    { label: 'Students', href: '/students', icon: <StudentsIcon /> },
  ] },
  { label: 'Business', items: [
    { label: 'Revenue', href: '/revenue', icon: <RevenueIcon />, superAdminOnly: true },
    { label: 'Transactions', href: '/transactions', icon: <TransactionsIcon /> },
  ] },
  { label: 'Feedback', items: [
    { label: 'Reviews', href: '/reviews', icon: <ReviewsIcon /> },
    { label: 'Support', href: '/support', icon: <SupportIcon /> },
  ] },
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
                      'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                      collapsed && 'justify-center px-0',
                      active ? 'bg-sidebar-active text-white font-medium' : 'text-sidebar-text hover:bg-white/5',
                    )}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
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
        title={collapsed ? 'Expand' : undefined}
        className={cn(
          'py-3 text-xs text-white/50 hover:text-white border-t border-white/10',
          collapsed ? 'flex justify-center' : 'px-4 text-left',
        )}
      >
        {collapsed ? '→' : '← Collapse'}
      </button>
    </aside>
  );
}
