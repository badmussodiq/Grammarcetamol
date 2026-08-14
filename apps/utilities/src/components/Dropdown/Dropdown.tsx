'use client';

import type {ReactNode} from 'react';
import {useEffect, useRef, useState} from 'react';
import {cn} from '../../utils/cn';

export interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({ trigger, items, align = 'left', className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <div onClick={() => setOpen((v) => !v)} style={{ cursor: 'pointer' }}>
        {trigger}
      </div>
      {open && (
        <div
          className={cn(
            'absolute top-full mt-1 z-50 bg-surface border border-border rounded-lg shadow-md min-w-[160px] py-1',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              disabled={item.disabled}
              onClick={() => { if (!item.disabled) { item.onClick(); setOpen(false); } }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                item.destructive ? 'text-error' : 'text-[#0F172A]',
                item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-background cursor-pointer',
              )}
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
