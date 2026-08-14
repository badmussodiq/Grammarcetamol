import {Type} from 'class-transformer';
import {ArrayMinSize, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min, ValidateNested} from 'class-validator';

export class CreateSessionFileDto {
  @IsUUID()
  @IsOptional()
  lessonId?: string;

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsInt()
  @Min(1)
  fileSize!: number;

  @IsString()
  @IsNotEmpty()
  fileType!: string;

  @IsString()
  @IsOptional()
  mimeType?: string;

  /** Client-computed SHA-256 hex digest of the whole file, per US-ADM-007 — a separate
   * integrity record from S3/MinIO's own per-part ETag (see upload_chunks.etag). */
  @IsString()
  @IsNotEmpty()
  checksum!: string;
}

export class CreateSessionDto {
  @IsUUID()
  courseId!: string;

  @ValidateNested({ each: true })
  @Type(() => CreateSessionFileDto)
  @ArrayMinSize(1)
  files!: CreateSessionFileDto[];
}
