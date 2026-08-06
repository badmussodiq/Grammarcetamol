import { apiFetch } from '@grammarcetamol/utilities';

export interface UploadChunk {
  id: string;
  fileId: string;
  chunkIndex: number;
  startByte: string;
  endByte: string;
  size: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  etag: string | null;
}

export interface UploadFile {
  id: string;
  sessionId: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  mimeType: string | null;
  status: 'preparing' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: string;
  storageProvider: string;
  storageMultipartId: string | null;
}

export interface UploadSession {
  id: string;
  courseId: string;
  status: string;
}

export interface SessionDetail {
  session: UploadSession;
  files: (UploadFile & { chunks: UploadChunk[] })[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export const uploadsApi = {
  createSession(courseId: string, files: { lessonId?: string; fileName: string; fileSize: number; fileType: string; mimeType?: string; checksum: string }[]) {
    return apiFetch<ApiResponse<SessionDetail>>('/api/uploads/sessions', {
      method: 'POST',
      body: JSON.stringify({ courseId, files }),
    });
  },

  presignChunk(fileId: string, chunkIndex: number) {
    return apiFetch<ApiResponse<{ url: string; partNumber: number; expiresInSeconds: number }>>(
      `/api/uploads/files/${fileId}/chunks/${chunkIndex}/presign`,
    );
  },

  completeChunk(fileId: string, chunkIndex: number, etag: string) {
    return apiFetch<ApiResponse<{ status: string }>>(`/api/uploads/files/${fileId}/chunks/${chunkIndex}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ etag }),
    });
  },

  completeFile(fileId: string) {
    return apiFetch<ApiResponse<UploadFile>>(`/api/uploads/files/${fileId}/complete`, { method: 'POST' });
  },

  failFile(fileId: string, errorMessage: string, errorCode?: string) {
    return apiFetch<ApiResponse<{ status: string }>>(`/api/uploads/files/${fileId}/fail`, {
      method: 'PATCH',
      body: JSON.stringify({ errorCode, errorMessage }),
    });
  },
};

/** Pure — SHA-256 hex digest via the browser's native Web Crypto API, no library needed.
 * Matches US-ADM-007's "SHA-256 checksum" requirement; this is a client-side integrity record,
 * separate from S3/MinIO's own per-part ETag. */
export async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
