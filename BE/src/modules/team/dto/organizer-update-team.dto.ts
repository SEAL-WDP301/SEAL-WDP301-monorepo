import { IsEnum, IsString, IsOptional, ValidateIf } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TeamStatus } from "@prisma/client";

export class OrganizerUpdateTeamDto {
  @ApiProperty({ enum: TeamStatus })
  @IsEnum(TeamStatus)
  status: TeamStatus;

  @ApiPropertyOptional()
  @ValidateIf(
    (o) =>
      o.status === TeamStatus.rejected || o.status === TeamStatus.disqualified,
  )
  @IsString()
  @IsOptional()
  reason?: string;
}
