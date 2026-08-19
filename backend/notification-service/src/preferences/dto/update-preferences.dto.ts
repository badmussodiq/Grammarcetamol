import {Type} from 'class-transformer';
import {IsBoolean, IsObject, IsOptional, ValidateNested} from 'class-validator';

class ChannelPreferenceDto {
  @IsBoolean()
  inApp!: boolean;

  @IsBoolean()
  email!: boolean;
}

// One entry per PreferenceType (course/payment/live_class/announcement) — validated as a plain
// object of nested DTOs rather than named fields, since class-validator has no clean way to
// require "exactly these four keys" without repeating each one by hand; the service layer
// merges this over DEFAULT_PREFERENCES so a partial update never drops an unmentioned type.
// Each field is @IsOptional() precisely so a caller can send just the one type they're
// changing — the fields are only validated when present.
export class UpdatePreferencesDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ChannelPreferenceDto)
  course?: ChannelPreferenceDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ChannelPreferenceDto)
  payment?: ChannelPreferenceDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ChannelPreferenceDto)
  live_class?: ChannelPreferenceDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ChannelPreferenceDto)
  announcement?: ChannelPreferenceDto;
}
