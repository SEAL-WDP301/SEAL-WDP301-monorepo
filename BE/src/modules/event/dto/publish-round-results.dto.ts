import {
  IsInt,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";


export class TeamAwardDto {
  @ApiProperty()
  @IsInt()
  teamId: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  awardId?: number;
}

export class PublishRoundResultsDto {
  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 5],
    description: "Array of team IDs that should advance to the next round",
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  advancingTeamIds?: number[];

  @ApiPropertyOptional({
    type: [TeamAwardDto],
    description: "Awards for final round",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamAwardDto)
  @IsOptional()
  awards?: TeamAwardDto[];
}
