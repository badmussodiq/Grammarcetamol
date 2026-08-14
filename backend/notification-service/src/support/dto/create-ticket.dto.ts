import {IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength} from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;

  @IsOptional()
  @IsString()
  courseId?: string;
}
