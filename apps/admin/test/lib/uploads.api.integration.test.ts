/**
 * Integration test for uploadsApi — exercises the REAL apiFetch/fetch wiring (only
 * `global.fetch` is mocked, not the api module itself), unlike a pure unit test that would
 * mock `uploadsApi` wholesale. Confirms each method builds the exact request the real
 * upload-service backend expects, and that a real Response is parsed correctly back into
 * the shape callers rely on. Companion to ContentTab.test.tsx (component-level, mocks
 * coursesApi) and backend/integration-tests (hits the real running backend) — this is the
 * middle layer: real frontend code, fake network.
 */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {sha256Hex, uploadsApi} from '@/lib/uploads.api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('uploadsApi (integration — real fetch wiring, mocked network)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('createSession — POSTs courseId + files to /api/uploads/sessions and returns the parsed session', async () => {
    const envelope = { success: true, data: { session: { id: 's1', courseId: 'c1', status: 'uploading' }, files: [] }, error: null, timestamp: '' };
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope, 201));

    const result = await uploadsApi.createSession('c1', [
      { fileName: 'video.mp4', fileSize: 1000, fileType: 'video', checksum: 'abc123' },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:9000/api/uploads/sessions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      courseId: 'c1',
      files: [{ fileName: 'video.mp4', fileSize: 1000, fileType: 'video', checksum: 'abc123' }],
    });
    expect(result.data.session.id).toBe('s1');
  });

  it('presignChunk — GETs the presign endpoint for the right file+chunk', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { url: 'https://minio.test/presigned', partNumber: 1, expiresInSeconds: 900 }, error: null, timestamp: '' }),
    );

    const result = await uploadsApi.presignChunk('file-1', 0);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:9000/api/uploads/files/file-1/chunks/0/presign');
    expect(result.data.url).toBe('https://minio.test/presigned');
  });

  it('completeChunk — PATCHes with the etag', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { status: 'completed' }, error: null, timestamp: '' }));

    await uploadsApi.completeChunk('file-1', 0, '"real-etag-value"');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:9000/api/uploads/files/file-1/chunks/0/complete');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ etag: '"real-etag-value"' });
  });

  it('completeFile — POSTs with no body', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: 'file-1', status: 'completed' }, error: null, timestamp: '' }),
    );

    const result = await uploadsApi.completeFile('file-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:9000/api/uploads/files/file-1/complete');
    expect(init.method).toBe('POST');
    expect(result.data.status).toBe('completed');
  });

  it('failFile — PATCHes with errorCode + errorMessage', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { status: 'failed' }, error: null, timestamp: '' }));

    await uploadsApi.failFile('file-1', 'Chunk 2 failed to upload', 'CHUNK_UPLOAD_FAILED');

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ errorCode: 'CHUNK_UPLOAD_FAILED', errorMessage: 'Chunk 2 failed to upload' });
  });

  it('propagates a real ApiError when the server responds with an error envelope', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, data: null, error: 'File already completed', timestamp: '' }, 409));

    await expect(uploadsApi.completeFile('file-1')).rejects.toMatchObject({ status: 409, message: 'File already completed' });
  });
});

describe('sha256Hex (integration — real Web Crypto, no mocking)', () => {
  it('matches a known SHA-256 digest for a fixed input', async () => {
    // echo -n "hello world" | sha256sum
    const blob = new Blob(['hello world'], { type: 'text/plain' });
    const hex = await sha256Hex(blob);
    expect(hex).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });
});
