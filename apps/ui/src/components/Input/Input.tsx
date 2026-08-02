'use client';

import React, { useState } from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
}

const EyeIcon = ({ open }: { open: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
);

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, prefixIcon, suffixIcon, type, className, id, ...rest }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type;
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const hasSuffix = suffixIcon || isPassword;
    const paddingLeft = prefixIcon ? 36 : undefined;
    const paddingRight = hasSuffix ? 36 : undefined;

    return (
      <div className={cn('flex flex-col gap-1', className)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#0F172A]">
            {label}
          </label>
        )}
        <div className="relative">
          {prefixIcon && (
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]">
              {prefixIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            style={{ paddingLeft, paddingRight }}
            className={cn(
              'w-full rounded-md border px-3 py-2 text-sm text-[#0F172A] bg-white outline-none transition-all',
              'placeholder:text-[#94A3B8]',
              error
                ? 'border-[#EF4444] ring-2 ring-[#EF4444]'
                : 'border-[#E2E8F0] focus:ring-2 focus:ring-[#1E3A5F]',
            )}
            {...rest}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A]"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon open={showPassword} />
            </button>
          )}
          {!isPassword && suffixIcon && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B]">
              {suffixIcon}
            </span>
          )}
        </div>
        {error ? (
          <p className="text-sm text-[#EF4444]">{error}</p>
        ) : helperText ? (
          <p className="text-sm text-[#64748B]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
