import { IsInt, IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class RegisterIndividualDto {
  @ApiPropertyOptional({
    description:
      "Required when event.deferredTrackAssignment is false. Omitted when tracks are revealed later.",
  })
  @IsOptional()
  @IsInt()
  trackId?: number | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  skills?: string;
}
