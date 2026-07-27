import { OmitType } from "@nestjs/swagger";
import { OrganizerDashboardQueryDto } from "./organizer-dashboard-query.dto";

export class SubmissionsDashboardQueryDto extends OmitType(
  OrganizerDashboardQueryDto,
  ["limit"] as const,
) {}
