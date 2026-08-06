/**
 * Integration test for reviewsApi — exercises the REAL apiFetch/fetch wiring (only
 * `global.fetch` is mocked, not the api module itself). Companion to reviews.api.test.ts
 * (pure logic: isWithinEditWindow) and ReviewModal.test.tsx (component-level, mocks
 * reviewsApi wholesale) — this is the middle layer: real frontend code, fake network.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { reviewsApi } from '../../lib/reviews.api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('reviewsApi (integration — real fetch wiring, mocked network)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mine — GETs /api/reviews/mine with the courseId as a query param', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: null, error: null, timestamp: '' }));

    const result = await reviewsApi.mine('course-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8080/api/reviews/mine?courseId=course-1');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result.data).toBeNull();
  });

  it('create — POSTs to /api/reviews with the exact body shape, credentials included', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: 'r1', rating: 5, status: 'pending' }, error: null, timestamp: '' }, 201),
    );

    const result = await reviewsApi.create({ courseId: 'course-1', rating: 5, title: 'Great', comment: 'Loved it' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8080/api/reviews');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body)).toEqual({ courseId: 'course-1', rating: 5, title: 'Great', comment: 'Loved it' });
    expect(result.data.status).toBe('pending');
  });

  it('update — PATCHes /api/reviews/{id}', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'r1', rating: 3 }, error: null, timestamp: '' }));

    await reviewsApi.update('r1', { rating: 3 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8080/api/reviews/r1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ rating: 3 });
  });

  it('create — a real 403 (below the 50% completion gate) surfaces as an ApiError with the server message', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, data: null, error: 'You must complete at least 50% of the course to leave a review', timestamp: '' }, 403),
    );

    await expect(reviewsApi.create({ courseId: 'course-1', rating: 5 })).rejects.toMatchObject({
      status: 403,
      message: 'You must complete at least 50% of the course to leave a review',
    });
  });

  it('create — a real 409 (duplicate submission) surfaces as an ApiError', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, data: null, error: 'You have already reviewed this course', timestamp: '' }, 409));

    await expect(reviewsApi.create({ courseId: 'course-1', rating: 5 })).rejects.toMatchObject({ status: 409 });
  });
});
