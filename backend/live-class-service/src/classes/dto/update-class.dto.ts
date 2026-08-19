import {Type} from 'class-transformer';
import {IsArray, IsInt, IsOptional, IsPositive, IsString, Length, Min, ValidateNested} from 'class-validator';
import {ClassScheduleDto} from './class-schedule.dto';

// All fields optional by hand (no PartialType/@nestjs/mapped-types — not used anywhere else in
// this codebase, matches the "minimize external packages" convention).
export class UpdateClassDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsPositive()
  defaultPrice?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsString()
  billingInterval?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  materialsRetentionDays?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassScheduleDto)
  schedules?: ClassScheduleDto[];
}
