import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

export class AssistantChatContextDto {
  @ApiPropertyOptional({
    description: "Event from current page URL, if any",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  eventId?: number;

  @ApiPropertyOptional({
    description: "Last event the chat was talking about",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  focusEventId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  path?: string;
}

export class AssistantHistoryItemDto {
  @ApiProperty({ enum: ["user", "assistant"] })
  @IsString()
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @ApiProperty()
  @IsString()
  @MaxLength(800)
  text!: string;
}

export class AssistantChatDto {
  @ApiProperty({ example: "Event nào còn mở đăng ký?" })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message!: string;

  @ApiPropertyOptional({ enum: ["vi", "en"] })
  @IsOptional()
  @IsString()
  locale?: "vi" | "en";

  @ApiPropertyOptional({ type: AssistantChatContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AssistantChatContextDto)
  context?: AssistantChatContextDto;

  @ApiPropertyOptional({ type: [AssistantHistoryItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssistantHistoryItemDto)
  history?: AssistantHistoryItemDto[];
}
