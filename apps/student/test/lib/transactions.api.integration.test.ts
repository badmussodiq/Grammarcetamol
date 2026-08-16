import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {transactionsApi} from '@/lib/transactions.api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('transactionsApi (integration — real fetch wiring, mocked network)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listMine — GETs /api/payments/me with query params', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { items: [], page: 1, limit: 20, total: 0, totalPages: 0 }, error: null, timestamp: '' }),
    );

    await transactionsApi.listMine({ status: 'completed' });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:9000/api/payments/me?status=completed');
  });

  it('getById — GETs /api/payments/{id}', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: 'p1', course: null }, error: null, timestamp: '' }),
    );

    const result = await transactionsApi.getById('p1');

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:9000/api/payments/p1');
    expect(result.data.id).toBe('p1');
  });

  it('getById — a 403 (not the owner) surfaces as an ApiError', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, data: null, error: 'You do not have access to this transaction', timestamp: '' }, 403));

    await expect(transactionsApi.getById('p1')).rejects.toMatchObject({ status: 403 });
  });
});
