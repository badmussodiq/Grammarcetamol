import {IsEmail, IsOptional} from 'class-validator';

export class EnrollDto {
  @IsOptional()
  @IsEmail()
  email?: string;
}
