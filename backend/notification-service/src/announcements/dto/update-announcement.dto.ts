import {ArrayNotEmpty, IsArray, IsDateString, IsIn, IsOptional, IsString} from 'class-validator';

// All fields optional by hand — no PartialType/@nestjs/mapped-types, not used anywhere else in
// this codebase.
export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsIn(['all', 'courses', 'segments'])
  targetType?: 'all' | 'courses' | 'segments';

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  targetIds?: string[];

  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'critical'])
  priority?: 'low' | 'normal' | 'high' | 'critical';

  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
