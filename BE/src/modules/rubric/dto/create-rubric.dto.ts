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

  @ApiPropertyOptional({
    example: 10,
    description:
      "Deprecated — judges always score 0–10. Kept optional for API compat; server forces 10.",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  maxScore?: number;

  @ApiProperty({
    example: 2,
    description:
      "Share of the /10 final score (phần). All criteria weights for a round/track must total 10.",
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
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
