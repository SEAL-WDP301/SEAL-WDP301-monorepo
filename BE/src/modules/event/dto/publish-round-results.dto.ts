import {
  IsInt,
  IsArray,
  ValidateNested,
  IsOptional,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class TeamAwardDto {
  @ApiPropertyOptional()
  @IsInt()
  teamId: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  awardId?: number;
}

export class PublishRoundResultsDto {
  @ApiPropertyOptional({
    example: 3,
    description:
      "Non-final only. Number of top teams to advance (per track if track-specific, else whole round).",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  advanceCount?: number;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 5],
    description: "Deprecated — ignored. Server auto-selects by advanceCount.",
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  advancingTeamIds?: number[];

  @ApiPropertyOptional({
    type: [TeamAwardDto],
    description: "Deprecated — ignored. Server auto-assigns EventPrize by rank.",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamAwardDto)
  @IsOptional()
  awards?: TeamAwardDto[];
}
