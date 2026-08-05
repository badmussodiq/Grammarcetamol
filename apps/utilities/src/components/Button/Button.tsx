'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from '../Spinner/Spinner';
import { cn } from '../../utils/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, children, className, ...rest }, ref) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          variant === 'primary'     && 'bg-primary text-white hover:bg-primary-light rounded-md',
          variant === 'secondary'   && 'bg-surface border border-primary text-primary hover:bg-background rounded-md',
          variant === 'ghost'       && 'bg-transparent text-[#64748B] hover:bg-background rounded-md',
          variant === 'destructive' && 'bg-error text-white hover:bg-[#DC2626] rounded-md',
          size === 'sm' && 'px-3 py-1.5 text-sm',
          size === 'md' && 'px-4 py-2 text-base',
          size === 'lg' && 'px-6 py-3 text-lg',
          loading    && 'pointer-events-none opacity-70',
          isDisabled && !loading && 'opacity-50 cursor-not-allowed',
          className,
        )}
        {...rest}
      >
        {loading && <Spinner size={size === 'lg' ? 'md' : 'sm'} />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
