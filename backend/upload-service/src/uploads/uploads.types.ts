export interface UploadSession {
  id: string;
  courseId: string;
  courseName: string;
  adminId: string;
  status: 'preparing' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  uploadToken: string;
  chunkSize: number;
  maxConcurrent: number;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalBytes: string;
  uploadedBytes: string;
  expiresAt: string;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface UploadFile {
  id: string;
  sessionId: string;
  lessonId: string | null;
  fileName: string;
  fileSize: string;
  fileType: string;
  mimeType: string | null;
  status: 'preparing' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: string;
  uploadedBytes: string;
  checksum: string;
  storageProvider: string;
  storageBucket: string;
  storagePath: string;
  storageMultipartId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UploadChunk {
  id: string;
  fileId: string;
  chunkIndex: number;
  startByte: string;
  endByte: string;
  size: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  checksum: string | null;
  etag: string | null;
  retryCount: number;
  uploadedAt: string | null;
  createdAt: string;
}

export interface SessionDetail {
  session: UploadSession;
  files: (UploadFile & { chunks: UploadChunk[] })[];
}

interface UploadSessionRow {
  id: string;
  course_id: string;
  course_name: string;
  admin_id: string;
  status: string;
  upload_token: string;
  chunk_size: number;
  max_concurrent: number;
  total_files: number;
  completed_files: number;
  failed_files: number;
  total_bytes: string;
  uploaded_bytes: string;
  expires_at: string;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface UploadFileRow {
  id: string;
  session_id: string;
  lesson_id: string | null;
  file_name: string;
  file_size: string;
  file_type: string;
  mime_type: string | null;
  status: string;
  progress: string;
  uploaded_bytes: string;
  checksum: string;
  storage_provider: string;
  storage_bucket: string;
  storage_path: string;
  storage_multipart_id: string | null;
  error_code: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

interface UploadChunkRow {
  id: string;
  file_id: string;
  chunk_index: number;
  start_byte: string;
  end_byte: string;
  size: string;
  status: string;
  checksum: string | null;
  etag: string | null;
  retry_count: number;
  uploaded_at: string | null;
  created_at: string;
}

export function mapSessionRow(row: UploadSessionRow): UploadSession {
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: row.course_name,
    adminId: row.admin_id,
    status: row.status as UploadSession['status'],
    uploadToken: row.upload_token,
    chunkSize: row.chunk_size,
    maxConcurrent: row.max_concurrent,
    totalFiles: row.total_files,
    completedFiles: row.completed_files,
    failedFiles: row.failed_files,
    totalBytes: row.total_bytes,
    uploadedBytes: row.uploaded_bytes,
    expiresAt: row.expires_at,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export function mapFileRow(row: UploadFileRow): UploadFile {
  return {
    id: row.id,
    sessionId: row.session_id,
    lessonId: row.lesson_id,
    fileName: row.file_name,
    fileSize: row.file_size,
    fileType: row.file_type,
    mimeType: row.mime_type,
    status: row.status as UploadFile['status'],
    progress: row.progress,
    uploadedBytes: row.uploaded_bytes,
    checksum: row.checksum,
    storageProvider: row.storage_provider,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    storageMultipartId: row.storage_multipart_id,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    retryCount: row.retry_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapChunkRow(row: UploadChunkRow): UploadChunk {
  return {
    id: row.id,
    fileId: row.file_id,
    chunkIndex: row.chunk_index,
    startByte: row.start_byte,
    endByte: row.end_byte,
    size: row.size,
    status: row.status as UploadChunk['status'],
    checksum: row.checksum,
    etag: row.etag,
    retryCount: row.retry_count,
    uploadedAt: row.uploaded_at,
    createdAt: row.created_at,
  };
}
