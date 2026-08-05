import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class RefundPaymentDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
