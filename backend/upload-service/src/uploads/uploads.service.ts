import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import { PG_POOL } from '../config/database.module';
import { CourseServiceClient } from '../course-client/course-service.client';
import { UploadEventPublisher } from '../messaging/upload-event-publisher';
import { StorageProviderRegistry } from '../storage/storage-provider.registry';
import type { CreateSessionFileDto } from './dto/create-session.dto';
import { mapChunkRow, mapFileRow, mapSessionRow, type SessionDetail, type UploadChunk, type UploadFile } from './uploads.types';

// Matches implementation-phases.md §3.3's "Signed URLs... expire after 15 min" policy.
const PRESIGN_EXPIRY_SECONDS = 900;
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB — matches S3/MinIO multipart's own minimum part size

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly storageRegistry: StorageProviderRegistry,
    private readonly courseServiceClient: CourseServiceClient,
    private readonly eventPublisher: UploadEventPublisher,
    private readonly config: ConfigService,
  ) {}

  /** Never trusts a client-supplied course name — looks it up server-side via course-service,
   * same reasoning payment-service's checkout already applies to course price/currency. */
  async createSession(adminId: string, courseId: string, files: CreateSessionFileDto[]): Promise<SessionDetail> {
    const course = await this.courseServiceClient.getCourse(courseId);
    const provider = this.storageRegistry.getDefault();
    const bucket = this.config.get<string>('STORAGE_BUCKET', 'course-content');
    const totalBytes = files.reduce((sum, f) => sum + f.fileSize, 0);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const sessionResult = await client.query(
        `INSERT INTO upload_sessions (course_id, course_name, admin_id, status, upload_token, chunk_size, total_files, total_bytes)
         VALUES ($1, $2, $3, 'uploading', $4, $5, $6, $7)
         RETURNING *`,
        [courseId, course.title, adminId, randomUUID(), CHUNK_SIZE, files.length, totalBytes],
      );
      const session = mapSessionRow(sessionResult.rows[0]);

      const fileDetails: (UploadFile & { chunks: UploadChunk[] })[] = [];

      for (const file of files) {
        // Unique key per upload, not per filename — two admins uploading files called
        // "lesson1.mp4" for different courses (or even the same course) never collide.
        const key = `courses/${courseId}/${randomUUID()}-${sanitizeFileName(file.fileName)}`;
        const { uploadId } = await provider.createMultipartUpload(bucket, key, file.mimeType ?? 'application/octet-stream');

        const fileResult = await client.query(
          `INSERT INTO upload_files
             (session_id, lesson_id, file_name, file_size, file_type, mime_type, status, checksum,
              storage_provider, storage_bucket, storage_path, storage_multipart_id)
           VALUES ($1, $2, $3, $4, $5, $6, 'preparing', $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            session.id,
            file.lessonId ?? null,
            file.fileName,
            file.fileSize,
            file.fileType,
            file.mimeType ?? null,
            file.checksum,
            provider.name,
            bucket,
            key,
            uploadId,
          ],
        );
        const fileRow = mapFileRow(fileResult.rows[0]);

        const partCount = Math.ceil(file.fileSize / CHUNK_SIZE);
        const chunks: UploadChunk[] = [];
        for (let i = 0; i < partCount; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.fileSize) - 1;
          const chunkResult = await client.query(
            `INSERT INTO upload_chunks (file_id, chunk_index, start_byte, end_byte, size)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [fileRow.id, i, start, end, end - start + 1],
          );
          chunks.push(mapChunkRow(chunkResult.rows[0]));
        }

        fileDetails.push({ ...fileRow, chunks });
      }

      await client.query('COMMIT');

      this.eventPublisher.publishSessionStarted({
        sessionId: session.id,
        courseId,
        adminId,
        totalFiles: session.totalFiles,
        totalBytes: session.totalBytes,
      });

      return { session, files: fileDetails };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Full session + files + per-chunk status — what a resumed upload (browser crash/reopen)
   * reads to figure out exactly which chunks still need presigning. */
  async getSession(sessionId: string): Promise<SessionDetail> {
    const sessionResult = await this.pool.query(`SELECT * FROM upload_sessions WHERE id = $1`, [sessionId]);
    if (sessionResult.rowCount === 0) {
      throw new NotFoundException(`Upload session not found: ${sessionId}`);
    }
    const session = mapSessionRow(sessionResult.rows[0]);

    const filesResult = await this.pool.query(`SELECT * FROM upload_files WHERE session_id = $1 ORDER BY created_at`, [sessionId]);
    const files = await Promise.all(
      filesResult.rows.map(async (row) => {
        const file = mapFileRow(row);
        const chunksResult = await this.pool.query(`SELECT * FROM upload_chunks WHERE file_id = $1 ORDER BY chunk_index`, [file.id]);
        return { ...file, chunks: chunksResult.rows.map(mapChunkRow) };
      }),
    );

    return { session, files };
  }

  /** Also the retry/resume path — re-presigning an already-'uploading' or 'failed' chunk is
   * exactly how a dropped chunk gets retried, and how a whole session resumes after a browser
   * crash (call this again for every chunk that isn't 'completed' yet). */
  async presignChunk(fileId: string, chunkIndex: number): Promise<{ url: string; partNumber: number; expiresInSeconds: number }> {
    const file = await this.findFileOrThrow(fileId);
    if (file.status === 'completed') {
      throw new ConflictException('This file has already finished uploading');
    }
    if (!file.storageMultipartId) {
      throw new BadRequestException('This file has no active multipart upload');
    }

    const chunkResult = await this.pool.query(`SELECT * FROM upload_chunks WHERE file_id = $1 AND chunk_index = $2`, [fileId, chunkIndex]);
    if (chunkResult.rowCount === 0) {
      throw new NotFoundException(`Chunk ${chunkIndex} not found for file ${fileId}`);
    }
    const chunk = mapChunkRow(chunkResult.rows[0]);
    if (chunk.status === 'completed') {
      throw new ConflictException(`Chunk ${chunkIndex} is already uploaded`);
    }

    const provider = this.storageRegistry.get(file.storageProvider);
    const partNumber = chunkIndex + 1; // S3/MinIO parts are 1-indexed
    const url = await provider.presignUploadPart(file.storageBucket, file.storagePath, file.storageMultipartId, partNumber, PRESIGN_EXPIRY_SECONDS);

    const isRetry = chunk.status !== 'pending';
    await this.pool.query(`UPDATE upload_chunks SET status = 'uploading', retry_count = retry_count + $2 WHERE id = $1`, [
      chunk.id,
      isRetry ? 1 : 0,
    ]);
    await this.pool.query(`UPDATE upload_files SET status = 'uploading' WHERE id = $1 AND status = 'preparing'`, [fileId]);

    return { url, partNumber, expiresInSeconds: PRESIGN_EXPIRY_SECONDS };
  }

  async completeChunk(fileId: string, chunkIndex: number, etag: string): Promise<void> {
    const chunkResult = await this.pool.query(
      `UPDATE upload_chunks SET status = 'completed', etag = $3, uploaded_at = NOW()
       WHERE file_id = $1 AND chunk_index = $2
       RETURNING *`,
      [fileId, chunkIndex, etag],
    );
    if (chunkResult.rowCount === 0) {
      throw new NotFoundException(`Chunk ${chunkIndex} not found for file ${fileId}`);
    }
    const chunk = mapChunkRow(chunkResult.rows[0]);

    // Atomic increments, not read-modify-write — multiple chunks complete concurrently
    // (max_concurrent uploads in flight at once), so a compute-then-write from application code
    // would lose updates under real concurrency.
    const fileResult = await this.pool.query(
      `UPDATE upload_files
       SET uploaded_bytes = uploaded_bytes + $2,
           progress = LEAST(100, ROUND(((uploaded_bytes + $2)::numeric / NULLIF(file_size, 0)) * 100, 2))
       WHERE id = $1
       RETURNING session_id`,
      [fileId, chunk.size],
    );
    const sessionId = fileResult.rows[0].session_id as string;
    await this.pool.query(`UPDATE upload_sessions SET uploaded_bytes = uploaded_bytes + $2 WHERE id = $1`, [sessionId, chunk.size]);

    this.eventPublisher.publishChunkCompleted({ sessionId, fileId, chunkIndex, etag });
  }

  /** Finalizes the multipart upload on object storage once every chunk is in — this is the
   * point a file actually becomes a real, retrievable object, and where `upload.file.completed`
   * fires (the event media-service, Task 17, will eventually consume for transcoding). */
  async completeFile(fileId: string): Promise<UploadFile> {
    const file = await this.findFileOrThrow(fileId);
    if (file.status === 'completed') {
      return file;
    }
    if (!file.storageMultipartId) {
      throw new BadRequestException('This file has no active multipart upload');
    }

    const chunksResult = await this.pool.query(`SELECT * FROM upload_chunks WHERE file_id = $1 ORDER BY chunk_index`, [fileId]);
    const chunks = chunksResult.rows.map(mapChunkRow);
    const incomplete = chunks.filter((c) => c.status !== 'completed');
    if (incomplete.length > 0) {
      throw new BadRequestException(`${incomplete.length} chunk(s) are not uploaded yet`);
    }

    const provider = this.storageRegistry.get(file.storageProvider);
    await provider.completeMultipartUpload(
      file.storageBucket,
      file.storagePath,
      file.storageMultipartId,
      chunks.map((c) => ({ partNumber: c.chunkIndex + 1, etag: c.etag as string })),
    );

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const updatedFileResult = await client.query(`UPDATE upload_files SET status = 'completed', progress = 100 WHERE id = $1 RETURNING *`, [
        fileId,
      ]);
      const updatedFile = mapFileRow(updatedFileResult.rows[0]);

      const sessionResult = await client.query(
        `UPDATE upload_sessions SET completed_files = completed_files + 1 WHERE id = $1 RETURNING *`,
        [updatedFile.sessionId],
      );
      let session = mapSessionRow(sessionResult.rows[0]);
      if (session.completedFiles >= session.totalFiles) {
        const finished = await client.query(
          `UPDATE upload_sessions SET status = 'completed', completed_at = NOW() WHERE id = $1 RETURNING *`,
          [session.id],
        );
        session = mapSessionRow(finished.rows[0]);
      }

      await client.query('COMMIT');

      this.eventPublisher.publishFileCompleted({
        sessionId: session.id,
        fileId: updatedFile.id,
        courseId: session.courseId,
        lessonId: updatedFile.lessonId,
        storageProvider: updatedFile.storageProvider,
        storageBucket: updatedFile.storageBucket,
        storagePath: updatedFile.storagePath,
        mimeType: updatedFile.mimeType,
        fileSize: updatedFile.fileSize,
        checksum: updatedFile.checksum,
      });

      return updatedFile;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Client reports "I gave up retrying this chunk" (after its own exponential-backoff retry
   * loop, per US-ADM-007) — aborts the multipart upload on object storage so no orphaned
   * incomplete-upload storage cost lingers, and marks the file/session failed. */
  async failFile(fileId: string, errorCode: string | undefined, errorMessage: string): Promise<void> {
    const file = await this.findFileOrThrow(fileId);

    if (file.storageMultipartId) {
      try {
        await this.storageRegistry
          .get(file.storageProvider)
          .abortMultipartUpload(file.storageBucket, file.storagePath, file.storageMultipartId);
      } catch (err) {
        this.logger.warn(`Could not abort multipart upload for file ${fileId}: ${(err as Error).message}`);
      }
    }

    const result = await this.pool.query(
      `UPDATE upload_files SET status = 'failed', error_code = $2, error_message = $3 WHERE id = $1 RETURNING session_id`,
      [fileId, errorCode ?? null, errorMessage],
    );
    const sessionId = result.rows[0].session_id as string;

    const sessionResult = await this.pool.query(`UPDATE upload_sessions SET failed_files = failed_files + 1 WHERE id = $1 RETURNING *`, [
      sessionId,
    ]);
    const session = mapSessionRow(sessionResult.rows[0]);
    if (session.failedFiles >= session.totalFiles) {
      await this.pool.query(`UPDATE upload_sessions SET status = 'failed' WHERE id = $1`, [sessionId]);
    }

    this.eventPublisher.publishFailed({ sessionId, fileId, errorCode, errorMessage });
  }

  /** Resolves the file's own recorded provider/bucket/path (never "whatever's default today")
   * into a fresh short-lived signed GET URL. Callers — enrollment-service resolving lesson
   * playback, or an admin previewing content — must already have done their own authorization
   * check before calling this; this method itself has none beyond "the file exists." */
  async getDownloadUrl(fileId: string): Promise<{ url: string; expiresInSeconds: number }> {
    const file = await this.findFileOrThrow(fileId);
    if (file.status !== 'completed') {
      throw new BadRequestException('This file has not finished uploading yet');
    }
    const provider = this.storageRegistry.get(file.storageProvider);
    const url = await provider.presignDownload(file.storageBucket, file.storagePath, PRESIGN_EXPIRY_SECONDS);
    return { url, expiresInSeconds: PRESIGN_EXPIRY_SECONDS };
  }

  private async findFileOrThrow(fileId: string): Promise<UploadFile> {
    const result = await this.pool.query(`SELECT * FROM upload_files WHERE id = $1`, [fileId]);
    if (result.rowCount === 0) {
      throw new NotFoundException(`Upload file not found: ${fileId}`);
    }
    return mapFileRow(result.rows[0]);
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}
