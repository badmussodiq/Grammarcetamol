import {
    AbortMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    CreateBucketCommand,
    CreateMultipartUploadCommand,
    GetObjectCommand,
    HeadBucketCommand,
    S3Client,
    UploadPartCommand,
} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import type {MultipartUploadHandle, PartInfo, StorageProvider} from './storage-provider.interface';

export interface S3CompatibleConfig {
  name: string;
  /** Set for MinIO or any non-AWS S3-compatible backend; omit entirely for real AWS S3. */
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** MinIO (and most self-hosted S3-compatible stores) need path-style addressing
   * (http://host/bucket/key); real AWS S3 uses virtual-hosted-style and doesn't want this. */
  forcePathStyle?: boolean;
}

/**
 * One class, many instances. MinIO and AWS S3 both speak the S3 API, so the only real
 * difference between "the MinIO provider" and "the S3 provider" is which endpoint and
 * credentials it's constructed with — see StorageProviderRegistry for how instances get
 * registered under their provider name.
 */
export class S3CompatibleStorageProvider implements StorageProvider {
  readonly name: string;
  private readonly client: S3Client;

  constructor(config: S3CompatibleConfig) {
    this.name = config.name;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle ?? false,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  /** Best-effort bucket bootstrap for dev — creates the bucket if it doesn't exist yet. Not part
   * of the StorageProvider interface (bucket lifecycle isn't a per-upload concern); called once
   * at startup by StorageProviderRegistry. */
  async ensureBucket(bucket: string): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
  }

  async createMultipartUpload(bucket: string, key: string, contentType: string): Promise<MultipartUploadHandle> {
    const result = await this.client.send(
      new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    );
    if (!result.UploadId) {
      throw new Error('Object storage did not return an upload id');
    }
    return { uploadId: result.UploadId };
  }

  async presignUploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSeconds = 900,
  ): Promise<string> {
    const command = new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async completeMultipartUpload(bucket: string, key: string, uploadId: string, parts: PartInfo[]): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) },
      }),
    );
  }

  async abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void> {
    await this.client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
  }

  async presignDownload(bucket: string, key: string, expiresInSeconds = 900): Promise<string> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
