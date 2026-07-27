import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsDateString,
  IsInt,
  IsUrl,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";
import { Season, EventStatus } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CreateTrackDto } from "./create-track.dto";
import { CreateRoundDto } from "./create-round.dto";

export class CreatePrizeDto {
  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  id?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  quantity?: number;
}

export class EventFaqItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  answer: string;
}

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: "Public cover image URL for the event" })
  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ enum: Season })
  @IsEnum(Season)
  season: Season;

  @ApiProperty()
  @IsInt()
  year: number;

  @ApiPropertyOptional({ enum: EventStatus, default: EventStatus.draft })
  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  registrationDeadline?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  githubOrgUrl?: string;

  @ApiPropertyOptional({ type: [EventFaqItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventFaqItemDto)
  @IsOptional()
  faq?: EventFaqItemDto[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contact?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  rules?: string;

  @ApiPropertyOptional({ type: [CreatePrizeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePrizeDto)
  @IsOptional()
  prizes?: CreatePrizeDto[];

  @ApiProperty({ type: [CreateTrackDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTrackDto)
  tracks: CreateTrackDto[];

  @ApiProperty({ type: [CreateRoundDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRoundDto)
  rounds: CreateRoundDto[];
}
