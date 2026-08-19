/**
 * Component test for ChatPanel's locked/unlocked input state — the one piece of Task 41's UI
 * that's genuinely stateful business logic, not just layout: a student must never be able to
 * post while the instructor has locked the class chat, but must always be able to read it.
 */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import {ToastProvider} from '@grammarcetamol/utilities';
import {ChatPanel} from '@/components/ChatPanel';

// ChatPanel's message list comes from useClassChat, which opens a real Socket.IO connection —
// stub it out so component tests exercise the REST history load and the locked/unlocked UI
// without needing a live socket server.
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const MESSAGES = [
  { id: 'm1', classId: 'class-1', senderId: 'instructor-1', senderRole: 'instructor', body: 'Welcome to class!', createdAt: '2026-08-19T10:00:00.000Z' },
];

describe('ChatPanel', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ success: true, data: MESSAGES, error: null, timestamp: '' })));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('disables the message input and shows a locked notice when chatLocked is true', async () => {
    render(<ToastProvider><ChatPanel classId="class-1" chatLocked /></ToastProvider>);

    await waitFor(() => expect(screen.getByText('Welcome to class!')).toBeTruthy());
    expect(screen.getByText(/Chat is locked by the instructor/i)).toBeTruthy();
    expect(screen.queryByLabelText('Message')).toBeNull();
    expect(screen.queryByText('Send')).toBeNull();
  });

  it('shows an enabled message input and Send button when chatLocked is false', async () => {
    render(<ToastProvider><ChatPanel classId="class-1" chatLocked={false} /></ToastProvider>);

    await waitFor(() => expect(screen.getByText('Welcome to class!')).toBeTruthy());
    expect(screen.queryByText(/Chat is locked by the instructor/i)).toBeNull();
    const input = screen.getByLabelText('Message') as HTMLTextAreaElement;
    expect(input.disabled).toBe(false);
    // Send starts disabled until there's actual draft text to send.
    expect((screen.getByText('Send') as HTMLElement).closest('button')).toHaveProperty('disabled', true);
  });

  it('still shows every message when locked — read access is always available', async () => {
    render(<ToastProvider><ChatPanel classId="class-1" chatLocked /></ToastProvider>);
    await waitFor(() => expect(screen.getByText('Welcome to class!')).toBeTruthy());
  });
});
