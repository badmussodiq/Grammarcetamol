import {IsDateString, IsString} from 'class-validator';

export class CreateSessionDto {
  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsString()
  timezone!: string;
}
