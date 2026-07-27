import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsNumber,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class CreateRubricDto {
  @ApiProperty({ example: "Technical Implementation" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: "Code quality, architecture, and best practices",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxScore: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  roundId: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      "Omit or null for global rubrics that apply to all tracks in the round",
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  trackId?: number | null;
}
