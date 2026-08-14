import {Injectable, Logger, OnModuleInit} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {S3CompatibleStorageProvider} from './s3-compatible-storage.provider';
import type {StorageProvider} from './storage-provider.interface';

/**
 * Mirrors PaymentProviderRegistry's shape (interface + registry + "which one is active" config
 * value), applied to object storage instead of payment gateways.
 *
 * MinIO is always registered (today's only real backend). Real AWS S3 registers itself
 * automatically the moment AWS credentials are configured — no code change, just env vars, since
 * both are the same S3CompatibleStorageProvider class with different config.
 *
 * `STORAGE_PROVIDER` only decides where *new* uploads go. It is read once, at the moment a new
 * upload session is created (see UploadsService.createSession) — every already-created
 * upload_files row keeps the provider name it was given at creation time forever, in its own
 * `storage_provider` column, so switching this env var later never breaks or moves existing
 * files. Resuming, completing, or downloading an existing file always looks up its provider by
 * that stored value via `get(name)`, never via `getDefault()`.
 */
@Injectable()
export class StorageProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(StorageProviderRegistry.name);
  private readonly providers = new Map<string, StorageProvider>();

  constructor(private readonly config: ConfigService) {
    this.providers.set(
      'minio',
      new S3CompatibleStorageProvider({
        name: 'minio',
        endpoint: this.config.get<string>('MINIO_ENDPOINT', 'http://localhost:9013'),
        region: 'us-east-1', // MinIO ignores region but the AWS SDK requires a non-empty value
        accessKeyId: this.config.get<string>('MINIO_ACCESS_KEY', 'platform'),
        secretAccessKey: this.config.get<string>('MINIO_SECRET_KEY', 'platform12345'),
        forcePathStyle: true,
      }),
    );

    const awsAccessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    if (awsAccessKeyId) {
      this.providers.set(
        's3',
        new S3CompatibleStorageProvider({
          name: 's3',
          region: this.config.get<string>('AWS_REGION', 'us-east-1'),
          accessKeyId: awsAccessKeyId,
          secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY', ''),
        }),
      );
    }
  }

  async onModuleInit(): Promise<void> {
    const bucket = this.config.get<string>('STORAGE_BUCKET', 'course-content');
    for (const provider of this.providers.values()) {
      try {
        await (provider as S3CompatibleStorageProvider).ensureBucket(bucket);
        this.logger.log(`Bucket "${bucket}" ready on provider "${provider.name}"`);
      } catch (err) {
        this.logger.warn(`Could not ensure bucket "${bucket}" on provider "${provider.name}": ${(err as Error).message}`);
      }
    }
  }

  getDefault(): StorageProvider {
    return this.get(this.config.get<string>('STORAGE_PROVIDER', 'minio'));
  }

  get(name: string): StorageProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`No storage provider registered for "${name}"`);
    }
    return provider;
  }
}
