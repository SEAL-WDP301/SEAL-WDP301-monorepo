import { IsInt, IsNotEmpty, IsOptional, IsArray } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AssignJudgeDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  @IsNotEmpty()
  stakeholderIds: number[];

  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  roundId: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  trackIds?: number[];
}
