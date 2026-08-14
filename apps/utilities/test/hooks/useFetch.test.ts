import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, renderHook, waitFor} from '@testing-library/react';
import {useFetch} from '../../src/hooks/useFetch';

describe('useFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not fetch when path is null', () => {
    const { result } = renderHook(() => useFetch(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('starts loading immediately when a path is given', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useFetch<{ id: string }>('/api/thing'));
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('populates data on a successful response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: '1' } }),
    });

    const { result } = renderHook(() => useFetch<{ id: string }>('/api/thing'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({ id: '1' });
    expect(result.current.error).toBeNull();
  });

  it('surfaces the server error message when the response is not ok', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server exploded' }),
    });

    const { result } = renderHook(() => useFetch('/api/thing'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Server exploded');
    expect(result.current.data).toBeNull();
  });

  it('refetch triggers a second request', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: '1' } }),
    });

    const { result } = renderHook(() => useFetch('/api/thing'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    act(() => result.current.refetch());
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });
});
