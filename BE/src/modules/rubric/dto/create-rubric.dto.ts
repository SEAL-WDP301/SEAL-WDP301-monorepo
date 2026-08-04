import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
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
    example: 20,
    description:
      "Weight percent of the final /10 score. Criteria for a round must total 100. Decimals allowed.",
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  weight: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  roundId: number;

  @ApiPropertyOptional({
    example: null,
    description:
      "Deprecated — ignored. Rubrics are shared by all tracks in the round (trackId null).",
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  trackId?: number | null;
}
