import {BadRequestException, ConflictException, NotFoundException} from '@nestjs/common';
import type {ConfigService} from '@nestjs/config';
import type {Pool} from 'pg';
import type {CourseServiceClient} from '@/course-client/course-service.client';
import type {UploadEventPublisher} from '@/messaging/upload-event-publisher';
import type {StorageProviderRegistry} from '@/storage/storage-provider.registry';
import {UploadsService} from '@/uploads/uploads.service';

// ---------------------------------------------------------------------------
// Row builders — snake_case, matching what `pg` actually returns from a SELECT/RETURNING.
// ---------------------------------------------------------------------------

function sessionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'session-1',
    course_id: 'course-1',
    course_name: 'Everyday Conversation Skills',
    admin_id: 'admin-1',
    status: 'uploading',
    upload_token: 'token-1',
    chunk_size: 5242880,
    max_concurrent: 5,
    total_files: 1,
    completed_files: 0,
    failed_files: 0,
    total_bytes: '3145728',
    uploaded_bytes: '0',
    expires_at: '2026-08-13T00:00:00.000Z',
    started_at: '2026-08-06T00:00:00.000Z',
    updated_at: '2026-08-06T00:00:00.000Z',
    completed_at: null,
    ...overrides,
  };
}

function fileRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'file-1',
    session_id: 'session-1',
    lesson_id: 'lesson-1',
    file_name: 'lesson1.mp4',
    file_size: '3145728',
    file_type: 'video',
    mime_type: 'video/mp4',
    status: 'preparing',
    progress: '0.00',
    uploaded_bytes: '0',
    checksum: 'abc123',
    storage_provider: 'minio',
    storage_bucket: 'course-content',
    storage_path: 'courses/course-1/uuid-lesson1.mp4',
    storage_multipart_id: 'multipart-1',
    error_code: null,
    error_message: null,
    retry_count: 0,
    created_at: '2026-08-06T00:00:00.000Z',
    updated_at: '2026-08-06T00:00:00.000Z',
    ...overrides,
  };
}

function chunkRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'chunk-1',
    file_id: 'file-1',
    chunk_index: 0,
    start_byte: '0',
    end_byte: '3145727',
    size: '3145728',
    status: 'pending',
    checksum: null,
    etag: null,
    retry_count: 0,
    uploaded_at: null,
    created_at: '2026-08-06T00:00:00.000Z',
    ...overrides,
  };
}

describe('UploadsService', () => {
  let pool: { query: jest.Mock; connect: jest.Mock };
  let client: { query: jest.Mock; release: jest.Mock };
  let storageRegistry: { get: jest.Mock; getDefault: jest.Mock };
  let provider: {
    name: string;
    createMultipartUpload: jest.Mock;
    presignUploadPart: jest.Mock;
    completeMultipartUpload: jest.Mock;
    abortMultipartUpload: jest.Mock;
    presignDownload: jest.Mock;
  };
  let courseServiceClient: { getCourse: jest.Mock };
  let eventPublisher: {
    publishSessionStarted: jest.Mock;
    publishChunkCompleted: jest.Mock;
    publishFileCompleted: jest.Mock;
    publishFailed: jest.Mock;
  };
  let config: { get: jest.Mock };
  let service: UploadsService;

  beforeEach(() => {
    client = { query: jest.fn(), release: jest.fn() };
    pool = { query: jest.fn(), connect: jest.fn().mockResolvedValue(client) };

    provider = {
      name: 'minio',
      createMultipartUpload: jest.fn().mockResolvedValue({ uploadId: 'multipart-1' }),
      presignUploadPart: jest.fn().mockResolvedValue('https://minio.local/signed-put-url'),
      completeMultipartUpload: jest.fn().mockResolvedValue(undefined),
      abortMultipartUpload: jest.fn().mockResolvedValue(undefined),
      presignDownload: jest.fn().mockResolvedValue('https://minio.local/signed-get-url'),
    };
    storageRegistry = {
      get: jest.fn().mockReturnValue(provider),
      getDefault: jest.fn().mockReturnValue(provider),
    };

    courseServiceClient = {
      getCourse: jest.fn().mockResolvedValue({ id: 'course-1', title: 'Everyday Conversation Skills' }),
    };

    eventPublisher = {
      publishSessionStarted: jest.fn(),
      publishChunkCompleted: jest.fn(),
      publishFileCompleted: jest.fn(),
      publishFailed: jest.fn(),
    };

    config = { get: jest.fn((_key: string, fallback?: unknown) => fallback) };

    service = new UploadsService(
      pool as unknown as Pool,
      storageRegistry as unknown as StorageProviderRegistry,
      courseServiceClient as unknown as CourseServiceClient,
      eventPublisher as unknown as UploadEventPublisher,
      config as unknown as ConfigService,
    );
  });

  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------

  describe('createSession', () => {
    it('looks up the course server-side rather than trusting a client-supplied name', async () => {
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [sessionRow()] }) // INSERT upload_sessions
        .mockResolvedValueOnce({ rows: [fileRow()] }) // INSERT upload_files
        .mockResolvedValueOnce({ rows: [chunkRow()] }) // INSERT upload_chunks (1 chunk, 3MB < 5MB)
        .mockResolvedValueOnce(undefined); // COMMIT

      await service.createSession('admin-1', 'course-1', [
        { fileName: 'lesson1.mp4', fileSize: 3 * 1024 * 1024, fileType: 'video', mimeType: 'video/mp4', checksum: 'abc123', lessonId: 'lesson-1' },
      ]);

      expect(courseServiceClient.getCourse).toHaveBeenCalledWith('course-1');
      const sessionInsertCall = client.query.mock.calls[1];
      expect(sessionInsertCall[1]).toContain('Everyday Conversation Skills');
    });

    it('splits a file larger than one chunk into multiple upload_chunks rows', async () => {
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [sessionRow({ total_bytes: '12582912' })] }) // session (12MB)
        .mockResolvedValueOnce({ rows: [fileRow({ file_size: '12582912' })] }) // file
        .mockResolvedValueOnce({ rows: [chunkRow({ chunk_index: 0 })] }) // chunk 0: 0-5242879
        .mockResolvedValueOnce({ rows: [chunkRow({ chunk_index: 1, start_byte: '5242880', end_byte: '10485759' })] }) // chunk 1
        .mockResolvedValueOnce({ rows: [chunkRow({ chunk_index: 2, start_byte: '10485760', end_byte: '12582911', size: '2097152' })] }) // chunk 2 (remainder)
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await service.createSession('admin-1', 'course-1', [
        { fileName: 'lesson1.mp4', fileSize: 12 * 1024 * 1024, fileType: 'video', checksum: 'abc123' },
      ]);

      expect(result.files[0].chunks).toHaveLength(3);
      // 3 chunk INSERTs, sandwiched between the session/file INSERTs and BEGIN/COMMIT.
      expect(client.query).toHaveBeenCalledTimes(7);
    });

    it('creates a multipart upload on the default storage provider and records it on the file row', async () => {
      client.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [sessionRow()] })
        .mockResolvedValueOnce({ rows: [fileRow()] })
        .mockResolvedValueOnce({ rows: [chunkRow()] })
        .mockResolvedValueOnce(undefined);

      await service.createSession('admin-1', 'course-1', [
        { fileName: 'lesson1.mp4', fileSize: 3 * 1024 * 1024, fileType: 'video', mimeType: 'video/mp4', checksum: 'abc123' },
      ]);

      expect(storageRegistry.getDefault).toHaveBeenCalled();
      expect(provider.createMultipartUpload).toHaveBeenCalledWith('course-content', expect.stringContaining('courses/course-1/'), 'video/mp4');
      const fileInsertParams = client.query.mock.calls[2][1];
      expect(fileInsertParams).toContain('minio'); // storage_provider
      expect(fileInsertParams).toContain('multipart-1'); // storage_multipart_id
    });

    it('publishes upload.session.started after committing', async () => {
      client.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [sessionRow()] })
        .mockResolvedValueOnce({ rows: [fileRow()] })
        .mockResolvedValueOnce({ rows: [chunkRow()] })
        .mockResolvedValueOnce(undefined);

      await service.createSession('admin-1', 'course-1', [
        { fileName: 'lesson1.mp4', fileSize: 3 * 1024 * 1024, fileType: 'video', checksum: 'abc123' },
      ]);

      expect(eventPublisher.publishSessionStarted).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-1', courseId: 'course-1', adminId: 'admin-1' }),
      );
    });

    it('rolls back and releases the client if any insert fails', async () => {
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [sessionRow()] }) // session insert ok
        .mockRejectedValueOnce(new Error('db exploded')); // file insert fails

      await expect(
        service.createSession('admin-1', 'course-1', [
          { fileName: 'lesson1.mp4', fileSize: 3 * 1024 * 1024, fileType: 'video', checksum: 'abc123' },
        ]),
      ).rejects.toThrow('db exploded');

      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getSession
  // -------------------------------------------------------------------------

  describe('getSession', () => {
    it('throws NotFoundException for an unknown session', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      await expect(service.getSession('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the session with files nested with their chunks', async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [sessionRow()] }) // session
        .mockResolvedValueOnce({ rows: [fileRow()] }) // files for session
        .mockResolvedValueOnce({ rows: [chunkRow()] }); // chunks for that file

      const result = await service.getSession('session-1');

      expect(result.session.id).toBe('session-1');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].chunks).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // presignChunk — also the retry/resume path
  // -------------------------------------------------------------------------

  describe('presignChunk', () => {
    it('rejects presigning against an already-completed file', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [fileRow({ status: 'completed' })] });
      await expect(service.presignChunk('file-1', 0)).rejects.toThrow(ConflictException);
    });

    it('rejects presigning an already-completed chunk', async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [fileRow()] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [chunkRow({ status: 'completed' })] });
      await expect(service.presignChunk('file-1', 0)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for a chunk index that does not exist', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [fileRow()] }).mockResolvedValueOnce({ rowCount: 0, rows: [] });
      await expect(service.presignChunk('file-1', 99)).rejects.toThrow(NotFoundException);
    });

    it('presigns a pending chunk without counting it as a retry', async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [fileRow()] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [chunkRow({ status: 'pending' })] })
        .mockResolvedValueOnce(undefined) // UPDATE chunk status
        .mockResolvedValueOnce(undefined); // UPDATE file status

      const result = await service.presignChunk('file-1', 0);

      expect(result.url).toBe('https://minio.local/signed-put-url');
      expect(result.partNumber).toBe(1); // S3 parts are 1-indexed
      const chunkUpdateParams = pool.query.mock.calls[2][1];
      expect(chunkUpdateParams).toEqual(['chunk-1', 0]); // retry_count += 0
    });

    it('counts re-presigning an already-uploading chunk as a retry', async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [fileRow()] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [chunkRow({ status: 'uploading' })] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await service.presignChunk('file-1', 0);

      const chunkUpdateParams = pool.query.mock.calls[2][1];
      expect(chunkUpdateParams).toEqual(['chunk-1', 1]); // retry_count += 1
    });

    it('resolves the correct provider by the file\'s own recorded storage_provider, not the current default', async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [fileRow({ storage_provider: 's3' })] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [chunkRow()] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await service.presignChunk('file-1', 0);

      expect(storageRegistry.get).toHaveBeenCalledWith('s3');
      expect(storageRegistry.getDefault).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // completeChunk
  // -------------------------------------------------------------------------

  describe('completeChunk', () => {
    it('throws NotFoundException when the chunk does not exist', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      await expect(service.completeChunk('file-1', 0, 'etag-abc')).rejects.toThrow(NotFoundException);
    });

    it('atomically increments file and session uploaded_bytes and publishes the event', async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [chunkRow({ status: 'completed', etag: 'etag-abc' })] }) // UPDATE chunk
        .mockResolvedValueOnce({ rows: [{ session_id: 'session-1' }] }) // UPDATE file bytes/progress
        .mockResolvedValueOnce(undefined); // UPDATE session bytes

      await service.completeChunk('file-1', 0, 'etag-abc');

      const fileUpdateParams = pool.query.mock.calls[1][1];
      expect(fileUpdateParams).toEqual(['file-1', '3145728']); // chunk.size passed straight through
      expect(eventPublisher.publishChunkCompleted).toHaveBeenCalledWith({
        sessionId: 'session-1',
        fileId: 'file-1',
        chunkIndex: 0,
        etag: 'etag-abc',
      });
    });
  });

  // -------------------------------------------------------------------------
  // completeFile
  // -------------------------------------------------------------------------

  describe('completeFile', () => {
    it('is a no-op if the file is already completed', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [fileRow({ status: 'completed' })] });

      const result = await service.completeFile('file-1');

      expect(result.status).toBe('completed');
      expect(provider.completeMultipartUpload).not.toHaveBeenCalled();
    });

    it('rejects completion while any chunk is still not completed', async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [fileRow()] })
        .mockResolvedValueOnce({ rows: [chunkRow({ status: 'completed' }), chunkRow({ chunk_index: 1, status: 'pending' })] });

      await expect(service.completeFile('file-1')).rejects.toThrow(BadRequestException);
      expect(provider.completeMultipartUpload).not.toHaveBeenCalled();
    });

    it('completes the multipart upload with ordered {partNumber, etag} pairs', async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [fileRow()] })
        .mockResolvedValueOnce({
          rows: [
            chunkRow({ chunk_index: 0, status: 'completed', etag: 'etag-0' }),
            chunkRow({ id: 'chunk-2', chunk_index: 1, status: 'completed', etag: 'etag-1' }),
          ],
        });
      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [fileRow({ status: 'completed', progress: '100.00' })] }) // UPDATE file
        .mockResolvedValueOnce({ rows: [sessionRow({ completed_files: 1, total_files: 1 })] }) // UPDATE session completed_files
        .mockResolvedValueOnce({ rows: [sessionRow({ completed_files: 1, total_files: 1, status: 'completed' })] }) // UPDATE session -> completed
        .mockResolvedValueOnce(undefined); // COMMIT

      await service.completeFile('file-1');

      expect(provider.completeMultipartUpload).toHaveBeenCalledWith('course-content', 'courses/course-1/uuid-lesson1.mp4', 'multipart-1', [
        { partNumber: 1, etag: 'etag-0' },
        { partNumber: 2, etag: 'etag-1' },
      ]);
    });

    it('marks the session completed once every file in it is completed, and publishes upload.file.completed', async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [fileRow()] })
        .mockResolvedValueOnce({ rows: [chunkRow({ status: 'completed', etag: 'etag-0' })] });
      client.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [fileRow({ status: 'completed' })] })
        .mockResolvedValueOnce({ rows: [sessionRow({ completed_files: 1, total_files: 1 })] })
        .mockResolvedValueOnce({ rows: [sessionRow({ completed_files: 1, total_files: 1, status: 'completed', completed_at: '2026-08-06T01:00:00.000Z' })] })
        .mockResolvedValueOnce(undefined);

      await service.completeFile('file-1');

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'completed', completed_at = NOW()"),
        ['session-1'],
      );
      expect(eventPublisher.publishFileCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-1', fileId: 'file-1', courseId: 'course-1' }),
      );
    });

    it('leaves the session in progress when other files in it are not completed yet', async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [fileRow()] })
        .mockResolvedValueOnce({ rows: [chunkRow({ status: 'completed', etag: 'etag-0' })] });
      client.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [fileRow({ status: 'completed' })] })
        .mockResolvedValueOnce({ rows: [sessionRow({ completed_files: 1, total_files: 2 })] }) // 1 of 2 done
        .mockResolvedValueOnce(undefined); // COMMIT — no "mark session completed" query this time

      await service.completeFile('file-1');

      expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining("status = 'completed', completed_at = NOW()"), expect.anything());
    });
  });

  // -------------------------------------------------------------------------
  // failFile
  // -------------------------------------------------------------------------

  describe('failFile', () => {
    it('aborts the multipart upload on object storage before marking the file failed', async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [fileRow()] }) // findFileOrThrow
        .mockResolvedValueOnce({ rows: [{ session_id: 'session-1' }] }) // UPDATE upload_files
        .mockResolvedValueOnce({ rows: [sessionRow({ failed_files: 1, total_files: 1 })] }); // UPDATE upload_sessions

      await service.failFile('file-1', 'CHECKSUM_MISMATCH', 'retries exhausted');

      expect(provider.abortMultipartUpload).toHaveBeenCalledWith('course-content', 'courses/course-1/uuid-lesson1.mp4', 'multipart-1');
      expect(eventPublisher.publishFailed).toHaveBeenCalledWith({
        sessionId: 'session-1',
        fileId: 'file-1',
        errorCode: 'CHECKSUM_MISMATCH',
        errorMessage: 'retries exhausted',
      });
    });

    it('does not let an abort failure block marking the file failed', async () => {
      provider.abortMultipartUpload.mockRejectedValueOnce(new Error('storage unreachable'));
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [fileRow()] })
        .mockResolvedValueOnce({ rows: [{ session_id: 'session-1' }] })
        .mockResolvedValueOnce({ rows: [sessionRow({ failed_files: 1, total_files: 1 })] });

      await expect(service.failFile('file-1', undefined, 'retries exhausted')).resolves.toBeUndefined();
      expect(eventPublisher.publishFailed).toHaveBeenCalled();
    });

    it('marks the whole session failed once every file in it has failed', async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [fileRow()] })
        .mockResolvedValueOnce({ rows: [{ session_id: 'session-1' }] })
        .mockResolvedValueOnce({ rows: [sessionRow({ failed_files: 1, total_files: 1 })] })
        .mockResolvedValueOnce(undefined); // UPDATE upload_sessions SET status = 'failed'

      await service.failFile('file-1', undefined, 'retries exhausted');

      expect(pool.query).toHaveBeenCalledWith(`UPDATE upload_sessions SET status = 'failed' WHERE id = $1`, ['session-1']);
    });
  });

  // -------------------------------------------------------------------------
  // getDownloadUrl
  // -------------------------------------------------------------------------

  describe('getDownloadUrl', () => {
    it('rejects a file that has not finished uploading', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [fileRow({ status: 'uploading' })] });
      await expect(service.getDownloadUrl('file-1')).rejects.toThrow(BadRequestException);
    });

    it('resolves via the file\'s own recorded provider, not the current default', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [fileRow({ status: 'completed', storage_provider: 's3' })] });

      const result = await service.getDownloadUrl('file-1');

      expect(storageRegistry.get).toHaveBeenCalledWith('s3');
      expect(storageRegistry.getDefault).not.toHaveBeenCalled();
      expect(result.url).toBe('https://minio.local/signed-get-url');
      expect(result.expiresInSeconds).toBe(900);
    });
  });
});
