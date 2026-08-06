import { IsNotEmpty, IsString } from 'class-validator';

export class CompleteChunkDto {
  /** S3/MinIO's ETag for this part, read off the presigned PUT's response header
   * (`response.headers.get('ETag')`) by the uploading client — required, in order, to complete
   * the multipart upload. */
  @IsString()
  @IsNotEmpty()
  etag!: string;
}
