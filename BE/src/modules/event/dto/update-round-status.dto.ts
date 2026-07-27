import { IsEnum, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { RoundStatus } from "@prisma/client";

export class UpdateRoundStatusDto {
  @ApiProperty({ enum: RoundStatus })
  @IsEnum(RoundStatus)
  @IsNotEmpty()
  status: RoundStatus;
}
