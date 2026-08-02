'use client';

import React, { useEffect } from 'react';
import { cn } from '../../utils/cn';

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  onDismiss: (id: string) => void;
}

const typeStyles: Record<ToastProps['type'], { bg: string; text: string; border: string }> = {
  success: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
  error:   { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  warning: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  info:    { bg: '#E0E7FF', text: '#3730A3', border: '#C7D2FE' },
};

const Icons: Record<ToastProps['type'], React.ReactNode> = {
  success: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export function Toast({ id, type, message, duration = 4000, onDismiss }: ToastProps) {
  useEffect(() => {
    if (duration === 0) return;
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const styles = typeStyles[type];
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        backgroundColor: styles.bg,
        color: styles.text,
        border: `1px solid ${styles.border}`,
        borderRadius: 8,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 260,
        maxWidth: 380,
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        animation: 'slideInRight 0.25s ease-out',
      }}
    >
      <span style={{ flexShrink: 0 }}>{Icons[type]}</span>
      <span style={{ flex: 1, fontSize: 14 }}>{message}</span>
      <button
        onClick={() => onDismiss(id)}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: styles.text, padding: 2, lineHeight: 1 }}
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export interface ToastContainerProps {
  toasts: ToastProps[];
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 50,
      }}
    >
      {toasts.map((t) => (
        <Toast key={t.id} {...t} />
      ))}
    </div>
  );
}
