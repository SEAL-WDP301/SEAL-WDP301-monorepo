import { IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateRoundProblemFileDto {
  @ApiPropertyOptional({ description: "URL of the problem statement file / attachment", nullable: true })
  @IsOptional()
  @IsString()
  problemFileUrl?: string | null;
}
