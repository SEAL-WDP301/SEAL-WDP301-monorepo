import { OmitType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { OrganizerDashboardQueryDto } from "./organizer-dashboard-query.dto";

export class UpcomingDeadlinesQueryDto extends OmitType(
  OrganizerDashboardQueryDto,
  ["from", "to", "season", "year", "groupBy", "limit"] as const,
) {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 6;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  withinDays?: number = 30;
}
