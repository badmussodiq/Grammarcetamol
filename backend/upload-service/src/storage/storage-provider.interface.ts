export interface MultipartUploadHandle {
  uploadId: string;
}

export interface PartInfo {
  partNumber: number;
  etag: string;
}

/**
 * An object-storage-agnostic upload/download backend. S3CompatibleStorageProvider (backed by
 * @aws-sdk/client-s3) is the only implementation today, registered under two different names by
 * StorageProviderRegistry once both MinIO and real S3 are wanted — same class, different
 * endpoint/credentials, since MinIO speaks the S3 API too. A genuinely different backend (Azure
 * Blob, GCS) would be a new class implementing this interface plus a registry entry — never a
 * rewrite of UploadsService, mirroring PaymentProvider's pluggability.
 *
 * Every method takes bucket/key/uploadId explicitly rather than reading "the current default
 * provider" — a stored file's row in upload_files always records which provider/bucket/key it
 * actually lives on, and that recorded value (not whatever's configured as active today) is what
 * decides which provider instance handles a resume, a completion, or a future signed download.
 * Switching the default only changes where brand-new uploads go — see StorageProviderRegistry.
 */
export interface StorageProvider {
  readonly name: string;

  createMultipartUpload(bucket: string, key: string, contentType: string): Promise<MultipartUploadHandle>;

  presignUploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSeconds?: number,
  ): Promise<string>;

  completeMultipartUpload(bucket: string, key: string, uploadId: string, parts: PartInfo[]): Promise<void>;

  abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void>;

  /** Short-lived signed GET — never a permanent public URL. Only ever issued after a caller has
   * already passed a real authorization check (e.g. enrollment), never on request alone. */
  presignDownload(bucket: string, key: string, expiresInSeconds?: number): Promise<string>;
}
