import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { profileApi } from '../../lib/profile.api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('profileApi (integration — real fetch wiring, mocked network)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('updateMe — PATCHes /api/users/me with the exact body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'u1' }, error: null, timestamp: '' }));

    await profileApi.updateMe({ fullName: 'Jane Doe', preferences: { marketingEmails: false } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:9000/api/users/me');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ fullName: 'Jane Doe', preferences: { marketingEmails: false } });
  });

  it('changePassword — POSTs to /api/users/me/change-password', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: 'Password updated', error: null, timestamp: '' }));

    await profileApi.changePassword({ currentPassword: 'old', newPassword: 'NewPass1' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:9000/api/users/me/change-password');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ currentPassword: 'old', newPassword: 'NewPass1' });
  });

  it('changePassword — a 400 (wrong current password) surfaces as an ApiError', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, data: null, error: 'Current password is incorrect', timestamp: '' }, 400));

    await expect(profileApi.changePassword({ currentPassword: 'wrong', newPassword: 'NewPass1' })).rejects.toMatchObject({
      status: 400,
      message: 'Current password is incorrect',
    });
  });
});
