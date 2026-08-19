import {IsEmail, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Length} from 'class-validator';

// Generic counterpart to InitializePaymentDto — for one-time items that aren't a `courses`
// row (e.g. Task 39's Live Class Service). Same itemType/itemId/amount shape Task 38's
// CreateSubscriptionDto already established for the recurring case. itemId is deliberately
// just a string, not @IsUUID() — Live Class Service's classId is a MongoDB ObjectId hex
// string, not a UUID, and this DTO has no business assuming any particular item's id format
// (real bug found live-verifying Task 39, see V4__item_id_as_string.sql).
export class InitializeItemPaymentDto {
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

  @IsOptional()
  @IsEmail()
  email?: string;
}
