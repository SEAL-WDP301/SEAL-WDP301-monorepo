import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class SyncGoogleCalendarMeetingDto {
  @ApiPropertyOptional({ description: "ISO 8601 meeting start time" })
  @IsDateString()
  @IsOptional()
  meetingStartDate?: string;

  @ApiPropertyOptional({ description: "ISO 8601 meeting end time" })
  @IsDateString()
  @IsOptional()
  meetingEndDate?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsEmail({}, { each: true })
  @IsOptional()
  attendeeEmails?: string[];

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  sendInvitations?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  notifyParticipants?: boolean;

  @ApiPropertyOptional({ default: "Asia/Ho_Chi_Minh" })
  @IsString()
  @IsOptional()
  timeZone?: string;
}
