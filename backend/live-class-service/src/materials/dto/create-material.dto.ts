import {IsDateString, IsNotEmpty, IsOptional, IsString, IsUrl} from 'class-validator';

export class CreateMaterialDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsUrl()
  fileUrl!: string;

  // null/omitted = class-level material; set = scoped to that specific session.
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsDateString()
  visibleFrom?: string;
}
