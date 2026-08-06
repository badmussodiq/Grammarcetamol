import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError } from '../../src/lib/api';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns undefined for a 204 No Content response instead of parsing an empty body', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 204 });

    const result = await apiFetch('/api/thing', { method: 'DELETE' });

    expect(result).toBeUndefined();
  });

  it('attaches the parsed response body to a thrown ApiError', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: 'Course is not ready to publish', data: ['Cover image is required'] }),
    });

    await expect(apiFetch('/api/courses/1/publish', { method: 'POST' })).rejects.toMatchObject({
      message: 'Course is not ready to publish',
      body: { data: ['Cover image is required'] },
    });
  });

  it('throws a plain ApiError when the error body has no JSON', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not json'); },
    });

    let error: ApiError | undefined;
    try {
      await apiFetch('/api/thing');
    } catch (e) {
      error = e as ApiError;
    }
    expect(error).toBeInstanceOf(ApiError);
    expect(error?.message).toBe('An error occurred');
    expect(error?.body).toBeUndefined();
  });
});
