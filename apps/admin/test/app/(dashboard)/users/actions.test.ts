import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => ({ get: mockGet }),
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

const { toggleUserStatus } = await import('../../../../app/(dashboard)/users/actions');

function formDataFor(id: string, status: string) {
  const fd = new FormData();
  fd.set('id', id);
  fd.set('status', status);
  return fd;
}

describe('toggleUserStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    mockGet.mockReturnValue({ value: 'abc.jwt.token' });
    mockRevalidatePath.mockClear();
  });

  it('PATCHes the status endpoint with the forwarded access token cookie', async () => {
    await toggleUserStatus(formDataFor('user-123', 'SUSPENDED'));

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/users/user-123/status',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Cookie: 'access_token=abc.jwt.token' }),
        body: JSON.stringify({ status: 'SUSPENDED' }),
      }),
    );
  });

  it('omits the Cookie header when there is no access token', async () => {
    mockGet.mockReturnValue(undefined);

    await toggleUserStatus(formDataFor('user-123', 'ACTIVE'));

    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers).not.toHaveProperty('Cookie');
  });

  it('revalidates the users list after the update', async () => {
    await toggleUserStatus(formDataFor('user-123', 'ACTIVE'));
    expect(mockRevalidatePath).toHaveBeenCalledWith('/users');
  });

  it('still revalidates even if the backend is unreachable', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(toggleUserStatus(formDataFor('user-123', 'ACTIVE'))).resolves.not.toThrow();
    expect(mockRevalidatePath).toHaveBeenCalledWith('/users');
  });
});
