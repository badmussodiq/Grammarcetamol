'use client';

import React, { useRef } from 'react';
import { cn } from '../../utils/cn';

export interface TabItem {
  label: string;
  value: string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowRight') {
      const next = (index + 1) % tabs.length;
      tabRefs.current[next]?.focus();
    } else if (e.key === 'ArrowLeft') {
      const prev = (index - 1 + tabs.length) % tabs.length;
      tabRefs.current[prev]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(tabs[index].value);
    }
  };

  return (
    <div role="tablist" className={cn('flex border-b border-[#E2E8F0]', className)}>
      {tabs.map((tab, i) => {
        const isActive = tab.value === activeTab;
        return (
          <button
            key={tab.value}
            ref={(el) => { tabRefs.current[i] = el; }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              'px-4 py-2 text-sm transition-colors duration-150 ease-out border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]',
              isActive
                ? 'border-[#1E3A5F] text-[#1E3A5F] font-semibold'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
