import { OmitType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { OrganizerDashboardQueryDto } from "./organizer-dashboard-query.dto";

export class RecentRegistrationsQueryDto extends OmitType(
  OrganizerDashboardQueryDto,
  ["from", "to", "season", "year", "groupBy", "limit"] as const,
) {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 5;
}
