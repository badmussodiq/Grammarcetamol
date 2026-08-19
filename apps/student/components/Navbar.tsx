'use client';

import {useState} from 'react';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {Button, cn, Dropdown} from '@grammarcetamol/utilities';
import {useAuth} from '@/contexts/AuthContext';
import {NotificationBell} from '@/components/NotificationBell';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/courses', label: 'Courses' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName = user?.fullName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Student';
  const initials = displayName.slice(0, 1).toUpperCase();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-[72px] flex items-center justify-between gap-6">
        <Link href="/" className="text-xl font-bold text-primary flex-shrink-0">
          Grammarcetamol
        </Link>

        <nav className="hidden md:flex items-center gap-6 flex-1 justify-center">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors',
                pathname === link.href ? 'text-primary' : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4 flex-shrink-0">
          {isAuthenticated ? (
            <>
              <NotificationBell enabled={isAuthenticated} />
              <Dropdown
                align="right"
                trigger={
                  <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-semibold text-sm">
                    {initials}
                  </div>
                }
                items={[
                  { label: 'Dashboard', onClick: () => router.push('/dashboard') },
                  { label: 'Profile', onClick: () => router.push('/profile') },
                  { label: 'Settings', onClick: () => router.push('/settings') },
                  { label: 'Transactions', onClick: () => router.push('/transactions') },
                  { label: 'Logout', onClick: handleLogout, destructive: true },
                ]}
              />
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-text-secondary hover:text-text-primary">
                Login
              </Link>
              <Link href="/register">
                <Button size="sm">Get Started</Button>
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="md:hidden p-2 text-text-secondary"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-surface px-6 py-4 flex flex-col gap-3">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="text-sm font-medium text-text-primary">
              {link.label}
            </Link>
          ))}
          {isAuthenticated ? (
            <>
              <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-text-primary">Dashboard</Link>
              <Link href="/profile" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-text-primary">Profile</Link>
              <Link href="/settings" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-text-primary">Settings</Link>
              <Link href="/transactions" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-text-primary">Transactions</Link>
              <Link href="/notifications" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-text-primary">
                Notifications
              </Link>
              <button type="button" onClick={handleLogout} className="text-sm font-medium text-error text-left">Logout</button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-text-primary">Login</Link>
              <Link href="/register" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-primary">Get Started</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
