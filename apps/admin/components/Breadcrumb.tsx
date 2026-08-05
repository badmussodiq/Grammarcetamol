'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function labelFor(segment: string): string {
  if (UUID_PATTERN.test(segment)) return 'Detail';
  return segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Breadcrumb() {
  const pathname = usePathname() ?? '/';
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
    return <span className="text-sm font-medium text-text-primary">Dashboard</span>;
  }

  return (
    <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
      <Link href="/dashboard" className="text-text-secondary hover:text-text-primary">Dashboard</Link>
      {segments.map((segment, i) => {
        const href = `/${segments.slice(0, i + 1).join('/')}`;
        const isLast = i === segments.length - 1;
        return (
          <Fragment key={href}>
            <span className="text-text-muted">/</span>
            {isLast ? (
              <span className="text-text-primary font-medium">{labelFor(segment)}</span>
            ) : (
              <Link href={href} className="text-text-secondary hover:text-text-primary">{labelFor(segment)}</Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
