import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt } from "class-validator";

export class SuggestRubricsDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  roundId: number;
}
