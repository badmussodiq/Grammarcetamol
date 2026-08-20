import {Type} from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {ClassScheduleDto} from './class-schedule.dto';

export class CreateClassDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  // Optional — defaults to the caller in the controller. Lets a SUPER_ADMIN schedule a class
  // on behalf of a different admin/moderator (the actual instructor), which the admin
  // ClassForm's own "Instructor" selector already offered but silently had no effect until
  // this field existed — same "audit-trail field, not a foreign key" trust model as every
  // other cross-service id in this system (no live lookup against auth-service to confirm the
  // given id really is an admin/moderator).
  @IsOptional()
  @IsUUID()
  instructorId?: string;

  @IsIn(['GROUP', 'PRIVATE'])
  classType!: 'GROUP' | 'PRIVATE';

  @IsIn(['OPEN', 'INVITE_ONLY'])
  accessMode!: 'OPEN' | 'INVITE_ONLY';

  @IsIn(['FREE', 'ONE_TIME', 'RECURRING'])
  paymentModel!: 'FREE' | 'ONE_TIME' | 'RECURRING';

  @ValidateIf((o) => o.paymentModel !== 'FREE')
  @IsPositive()
  defaultPrice?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ValidateIf((o) => o.paymentModel === 'RECURRING')
  @IsIn(['daily', 'weekly', 'monthly', 'quarterly', 'biannually', 'annually'])
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
  @IsString()
  videoProvider?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassScheduleDto)
  schedules?: ClassScheduleDto[];
}
