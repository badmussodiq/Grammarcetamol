'use client';

import { ToastContainer } from '@grammarcetamol/ui';
import { useToast } from '../contexts/ToastContext';

export function ToastRenderer() {
  const { toasts, removeToast } = useToast();
  return (
    <ToastContainer
      toasts={toasts.map((t) => ({ ...t, onDismiss: removeToast }))}
    />
  );
}
