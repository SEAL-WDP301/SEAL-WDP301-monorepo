import { OmitType } from "@nestjs/swagger";
import { OrganizerDashboardQueryDto } from "./organizer-dashboard-query.dto";

export class EventsByMonthQueryDto extends OmitType(
  OrganizerDashboardQueryDto,
  ["from", "to", "groupBy", "limit"] as const,
) {}
