'use client';

import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { cn } from '../../utils/cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'fullscreen';
  children?: React.ReactNode;
  className?: string;
}

const sizeMap: Record<NonNullable<ModalProps['size']>, string | number> = {
  sm: 400,
  md: 560,
  lg: 720,
  fullscreen: '100%',
};

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, size = 'md', children, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (focusable && focusable.length > 0) focusable[0].focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const els = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (els.length === 0) return;
      const first = els[0]; const last = els[els.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const width = sizeMap[size];
  const isFullscreen = size === 'fullscreen';

  const panel = (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: isFullscreen ? 'stretch' : 'center', justifyContent: 'center', padding: isFullscreen ? 0 : 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        style={{
          backgroundColor: '#fff',
          borderRadius: isFullscreen ? 0 : 12,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          width,
          maxWidth: isFullscreen ? '100%' : 'calc(100vw - 32px)',
          maxHeight: isFullscreen ? '100vh' : 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.2s ease-out',
        }}
        className={className}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
          {title && <h3 id="modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#0F172A' }}>{title}</h3>}
          <button onClick={onClose} aria-label="Close modal" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4, borderRadius: 4, marginLeft: 'auto' }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: 20, flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return ReactDOM.createPortal(panel, document.body);
}
