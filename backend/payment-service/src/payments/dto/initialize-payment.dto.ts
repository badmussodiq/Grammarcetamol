import {IsEmail, IsOptional, IsUUID} from 'class-validator';

export class InitializePaymentDto {
  @IsUUID()
  courseId!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
