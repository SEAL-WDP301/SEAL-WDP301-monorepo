import { IsInt, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RegisterIndividualDto {
  @ApiProperty()
  @IsInt()
  trackId: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  skills?: string;
}
