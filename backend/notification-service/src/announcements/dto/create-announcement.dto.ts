import {ArrayNotEmpty, IsArray, IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, ValidateIf} from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsIn(['all', 'courses', 'segments'])
  targetType!: 'all' | 'courses' | 'segments';

  @ValidateIf((o) => o.targetType !== 'all')
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  targetIds?: string[];

  @IsIn(['low', 'normal', 'high', 'critical'])
  priority!: 'low' | 'normal' | 'high' | 'critical';

  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
