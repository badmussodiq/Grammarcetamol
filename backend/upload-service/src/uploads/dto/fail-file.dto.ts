import {IsNotEmpty, IsOptional, IsString} from 'class-validator';

export class FailFileDto {
  @IsString()
  @IsOptional()
  errorCode?: string;

  @IsString()
  @IsNotEmpty()
  errorMessage!: string;
}
