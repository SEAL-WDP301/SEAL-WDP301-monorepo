import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ScoreItemDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  criterionId: number;

  @ApiProperty({ example: 8.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  scoreValue: number;

  @ApiPropertyOptional({ example: "Strong architecture and clean code." })
  @IsString()
  @IsOptional()
  comment?: string;
}

export class SubmitScoresDto {
  @ApiProperty({ type: [ScoreItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScoreItemDto)
  scores: ScoreItemDto[];
}
