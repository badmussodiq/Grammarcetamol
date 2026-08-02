import React from 'react';
import { cn } from '../../utils/cn';

export interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  children?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<NonNullable<BadgeProps['variant']>, React.CSSProperties> = {
  success: { backgroundColor: '#D1FAE5', color: '#065F46' },
  warning: { backgroundColor: '#FEF3C7', color: '#92400E' },
  error:   { backgroundColor: '#FEE2E2', color: '#991B1B' },
  info:    { backgroundColor: '#E0E7FF', color: '#3730A3' },
  neutral: { backgroundColor: '#F1F5F9', color: '#475569' },
};

const dotColors: Record<NonNullable<BadgeProps['variant']>, string> = {
  success: '#065F46',
  warning: '#92400E',
  error:   '#991B1B',
  info:    '#3730A3',
  neutral: '#475569',
};

const sizeClasses: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function Badge({ variant = 'neutral', size = 'md', dot, children, className }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 font-medium rounded-full', sizeClasses[size], className)}
      style={variantStyles[variant]}
    >
      {dot && (
        <span
          style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dotColors[variant], display: 'inline-block', flexShrink: 0 }}
        />
      )}
      {children}
    </span>
  );
}
