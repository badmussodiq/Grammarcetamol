'use client';

import React from 'react';
import { Spinner } from '../Spinner/Spinner';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:     'bg-[#1E3A5F] text-white hover:bg-[#2A5285]',
  secondary:   'bg-white border border-[#1E3A5F] text-[#1E3A5F] hover:bg-[#F8FAFC]',
  ghost:       'bg-transparent text-[#64748B] hover:bg-[#F1F5F9]',
  destructive: 'bg-[#EF4444] text-white hover:bg-[#DC2626]',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-sm',
  md: 'px-4 py-2 text-base rounded-md',
  lg: 'px-6 py-3 text-lg rounded-md',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, children, className, ...rest }, ref) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2',
          variantStyles[variant],
          sizeStyles[size],
          loading && 'pointer-events-none opacity-70',
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
