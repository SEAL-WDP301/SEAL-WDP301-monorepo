import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  IsDateString,
  IsBoolean,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SubmissionType } from "@prisma/client";

export class CreateRoundDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  roundNumber: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: SubmissionType })
  @IsEnum(SubmissionType)
  submissionType: SubmissionType;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  id?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  submissionDeadline?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  maxFileSizeMb?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isTrackSpecific?: boolean;

  @ApiPropertyOptional({
    description: "Maximum teams advancing per track or across the event",
    minimum: 1,
    default: 3,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  advanceTeamLimit?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  trackId?: number | null;
}
