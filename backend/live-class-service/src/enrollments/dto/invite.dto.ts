import {IsOptional, IsPositive, IsUUID} from 'class-validator';

export class InviteDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsPositive()
  negotiatedPrice?: number;
}
