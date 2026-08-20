import {IsEmail, IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Length} from 'class-validator';

// Matches Paystack's own supported interval values — rejecting anything else here beats a
// confusing provider-side error deep in a fetch call.
const PAYSTACK_INTERVALS = ['daily', 'weekly', 'monthly', 'quarterly', 'biannually', 'annually'];

export class CreateSubscriptionDto {
  // Generic on purpose — payment-service has no concept of "live class", only an
  // item-type/item-id pair the caller (Task 39's Live Class Service, or anything billed
  // recurring later) supplies, same shape a one-time-payment `courseId` would if this
  // service needed to be item-agnostic there too.
  @IsString()
  @IsNotEmpty()
  itemType!: string;

  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsIn(PAYSTACK_INTERVALS)
  interval!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
