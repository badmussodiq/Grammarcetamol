/**
 * Component test for the /profile page — mocks only global.fetch (not the api modules), so
 * both AuthProvider's own /api/users/me call and ProfileTab's useFetch hit the same stub.
 * Focused on the behavior specific to this page: the Save button stays disabled until the
 * form is actually dirty, and the change-password form validates before calling the API.
 */
import type {ReactElement} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {ToastProvider} from '@grammarcetamol/utilities';
import {AuthProvider} from '@/contexts/AuthContext';
import ProfilePage from '../../../app/(main)/profile/page';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const PROFILE = {
  id: 'u1',
  email: 'jane@example.com',
  role: 'STUDENT',
  fullName: 'Jane Doe',
  phone: null,
  avatarUrl: null,
  country: null,
  timezone: null,
  bio: null,
  learningGoals: [],
  dateOfBirth: null,
  preferences: null,
};

function renderWithProviders(ui: ReactElement) {
  return render(
    <ToastProvider>
      <AuthProvider>{ui}</AuthProvider>
    </ToastProvider>,
  );
}

describe('ProfilePage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (String(url).includes('/api/users/me/change-password')) {
        return Promise.resolve(jsonResponse({ success: true, data: 'Password updated', error: null, timestamp: '' }));
      }
      if (String(url).includes('/api/users/me') && method === 'PATCH') {
        return Promise.resolve(jsonResponse({ success: true, data: { ...PROFILE }, error: null, timestamp: '' }));
      }
      if (String(url).includes('/api/users/me')) {
        return Promise.resolve(jsonResponse({ success: true, data: PROFILE, error: null, timestamp: '' }));
      }
      return Promise.resolve(jsonResponse({ success: true, data: null, error: null, timestamp: '' }));
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the profile and disables Save Changes until the form is dirty', async () => {
    renderWithProviders(<ProfilePage />);

    const saveButton = await screen.findByText('Save Changes');
    await waitFor(() => expect(screen.getByDisplayValue('Jane Doe')).toBeTruthy());

    expect(saveButton.closest('button')).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByDisplayValue('Jane Doe'), { target: { value: 'Jane Smith' } });

    expect(saveButton.closest('button')).toHaveProperty('disabled', false);
  });

  it('Account tab blocks submission when the new passwords do not match', async () => {
    renderWithProviders(<ProfilePage />);

    await screen.findByText('Save Changes');
    fireEvent.click(screen.getByText('Account'));

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldPass1' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPass1' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Mismatch1' } });
    fireEvent.click(screen.getByText('Change Password'));

    expect(await screen.findByText('Passwords do not match')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('change-password'))).toBe(false);
  });

  it('Account tab submits a matching password change', async () => {
    renderWithProviders(<ProfilePage />);

    await screen.findByText('Save Changes');
    fireEvent.click(screen.getByText('Account'));

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldPass1' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPass1' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewPass1' } });
    fireEvent.click(screen.getByText('Change Password'));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('change-password'))).toBe(true),
    );
  });
});
