'use client';

import { useState } from 'react';
import { cn } from '@grammarcetamol/utilities';
import type { FaqItem } from '@/lib/faqData';

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.question} className="rounded-lg border border-border bg-surface overflow-hidden">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="font-semibold text-text-primary">{item.question}</span>
              <span
                className={cn('text-text-secondary transition-transform duration-200 flex-shrink-0', isOpen && 'rotate-180')}
                aria-hidden
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-4 text-sm text-text-secondary leading-relaxed">{item.answer}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
