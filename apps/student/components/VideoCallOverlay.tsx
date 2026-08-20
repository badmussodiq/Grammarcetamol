'use client';

import {useEffect, useRef} from 'react';

// The room identifier is only ever used here, inside a mounted Jitsi instance — never rendered
// as a link/URL anywhere in the DOM, never passed through routing/query params. This is the
// one place PLAN.md Task 41 explicitly requires it to be confined to.
interface JitsiMeetExternalAPI {
  dispose(): void;
  on(event: string, listener: () => void): void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => JitsiMeetExternalAPI;
  }
}

export function VideoCallOverlay({ domain, roomId, onClose }: { domain: string; roomId: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiMeetExternalAPI | null>(null);

  useEffect(() => {
    let cancelled = false;
    const scriptSrc = `https://${domain}/external_api.js`;

    function mount() {
      if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return;
      const api = new window.JitsiMeetExternalAPI(domain, {
        roomName: roomId,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        userInfo: {},
      });
      api.on('readyToClose', onClose);
      api.on('videoConferenceLeft', onClose);
      apiRef.current = api;
    }

    if (window.JitsiMeetExternalAPI) {
      mount();
    } else {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`);
      if (existing) {
        existing.addEventListener('load', mount);
      } else {
        const script = document.createElement('script');
        script.src = scriptSrc;
        script.async = true;
        script.onload = mount;
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, roomId]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: '#000' }}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Leave call"
        style={{ position: 'absolute', top: 16, right: 16, zIndex: 101, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 14 }}
      >
        ✕ Leave
      </button>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
