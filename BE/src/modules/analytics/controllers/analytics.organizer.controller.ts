import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Role } from "../../../common/enums/role.enum";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { EventsByMonthQueryDto } from "../dto/events-by-month-query.dto";
import { OrganizerDashboardQueryDto } from "../dto/organizer-dashboard-query.dto";
import { ParticipantsByEventQueryDto } from "../dto/participants-by-event-query.dto";
import { RecentRegistrationsQueryDto } from "../dto/recent-registrations-query.dto";
import { RegistrationTrendQueryDto } from "../dto/registration-trend-query.dto";
import { SubmissionsDashboardQueryDto } from "../dto/submissions-dashboard-query.dto";
import { UpcomingDeadlinesQueryDto } from "../dto/upcoming-deadlines-query.dto";
import { AnalyticsOrganizerService } from "../services/analytics.organizer.service";

@ApiTags("Organizer Dashboard")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER, Role.ADMIN)
@Controller("organizer/dashboard")
export class AnalyticsOrganizerController {
  constructor(private readonly service: AnalyticsOrganizerService) {}

  @Get("filter-options")
  @ApiOperation({ summary: "Get accessible dashboard filter options" })
  @ApiResponse({ status: 200, description: "Filter options retrieved" })
  async getFilterOptions(@CurrentUser("id") organizerId: string) {
    return {
      message: "Dashboard filter options retrieved",
      data: await this.service.getFilterOptions(Number(organizerId)),
    };
  }

  @Get("overview")
  @ApiOperation({ summary: "Get organizer dashboard KPI overview" })
  async getOverview(
    @CurrentUser("id") organizerId: string,
    @Query() query: OrganizerDashboardQueryDto,
  ) {
    return {
      message: "Dashboard overview retrieved",
      data: await this.service.getOverview(Number(organizerId), query),
    };
  }

  @Get("events-by-month")
  @ApiOperation({
    summary: "Get created, starting and completed events by month",
  })
  async getEventsByMonth(
    @CurrentUser("id") organizerId: string,
    @Query() query: EventsByMonthQueryDto,
  ) {
    return {
      message: "Events by month retrieved",
      data: await this.service.getEventsByMonth(Number(organizerId), query),
    };
  }

  @Get("event-status")
  @ApiOperation({ summary: "Get event status distribution" })
  async getEventStatus(
    @CurrentUser("id") organizerId: string,
    @Query() query: OrganizerDashboardQueryDto,
  ) {
    return {
      message: "Event status distribution retrieved",
      data: await this.service.getEventStatus(Number(organizerId), query),
    };
  }

  @Get("registration-trend")
  @ApiOperation({ summary: "Get registration and approved participant trend" })
  async getRegistrationTrend(
    @CurrentUser("id") organizerId: string,
    @Query() query: RegistrationTrendQueryDto,
  ) {
    return {
      message: "Registration trend retrieved",
      data: await this.service.getRegistrationTrend(Number(organizerId), query),
    };
  }

  @Get("participation-conversion")
  @ApiOperation({ summary: "Get registration and team submission funnels" })
  async getParticipationConversion(
    @CurrentUser("id") organizerId: string,
    @Query() query: OrganizerDashboardQueryDto,
  ) {
    return {
      message: "Participation conversion retrieved",
      data: await this.service.getParticipationConversion(
        Number(organizerId),
        query,
      ),
    };
  }

  @Get("participants-by-event")
  @ApiOperation({ summary: "Get top events by approved participants" })
  async getParticipantsByEvent(
    @CurrentUser("id") organizerId: string,
    @Query() query: ParticipantsByEventQueryDto,
  ) {
    return {
      message: "Participants by event retrieved",
      data: await this.service.getParticipantsByEvent(
        Number(organizerId),
        query,
      ),
    };
  }

  @Get("submissions")
  @ApiOperation({ summary: "Get submission summary, status and activity" })
  async getSubmissions(
    @CurrentUser("id") organizerId: string,
    @Query() query: SubmissionsDashboardQueryDto,
  ) {
    return {
      message: "Submission dashboard retrieved",
      data: await this.service.getSubmissions(Number(organizerId), query),
    };
  }

  @Get("upcoming-deadlines")
  @ApiOperation({ summary: "Get upcoming event and submission deadlines" })
  async getUpcomingDeadlines(
    @CurrentUser("id") organizerId: string,
    @Query() query: UpcomingDeadlinesQueryDto,
  ) {
    return {
      message: "Upcoming deadlines retrieved",
      data: await this.service.getUpcomingDeadlines(Number(organizerId), query),
    };
  }

  @Get("recent-registrations")
  @ApiOperation({ summary: "Get latest student registrations" })
  async getRecentRegistrations(
    @CurrentUser("id") organizerId: string,
    @Query() query: RecentRegistrationsQueryDto,
  ) {
    return {
      message: "Recent registrations retrieved",
      data: await this.service.getRecentRegistrations(
        Number(organizerId),
        query,
      ),
    };
  }
}
