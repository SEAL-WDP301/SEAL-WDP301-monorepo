import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Role } from "../../../common/enums/role.enum";
import { EventOrganizerService } from "../services/event.organizer.service";
import { RoundRankingService } from "../services/round-ranking.service";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CreateEventDto } from "../dto/create-event.dto";
import { UpdateEventDto } from "../dto/update-event.dto";
import { UpdateEventStatusDto } from "../dto/update-event-status.dto";
import { UpdateRoundStatusDto } from "../dto/update-round-status.dto";

import { PublishRoundResultsDto } from "../dto/publish-round-results.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@ApiTags("Organizer/Events")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER, Role.ADMIN)
@Controller("organizer/events")
export class EventOrganizerController {
  constructor(
    private readonly eventOrganizerService: EventOrganizerService,
    private readonly roundRankingService: RoundRankingService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a new event" })
  async createEvent(
    @CurrentUser("id") userId: string,
    @Body() dto: CreateEventDto,
  ) {
    const event = await this.eventOrganizerService.createEvent(
      Number(userId),
      dto,
    );
    return { message: "Event created successfully", data: event };
  }

  @Get()
  @ApiOperation({ summary: "Get all events" })
  async getAllEvents(
    @CurrentUser("id") userId: string,
    @CurrentUser("role") role: string,
  ) {
    const events = await this.eventOrganizerService.getAllEvents(
      Number(userId),
      role === Role.ADMIN,
    );
    return { message: "Events fetched", data: events };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a managed event with private details" })
  async getEventById(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser("id") userId: string,
    @CurrentUser("role") role: string,
  ) {
    const event = await this.eventOrganizerService.getManagedEventById(
      id,
      Number(userId),
      role === Role.ADMIN,
    );
    return { message: "Event fetched", data: event };
  }

  @Put(":id")
  @ApiOperation({ summary: "Update an event" })
  async updateEvent(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEventDto,
  ) {
    const event = await this.eventOrganizerService.updateEvent(id, dto);
    return { message: "Event updated successfully", data: event };
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update event status" })
  async updateEventStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEventStatusDto,
  ) {
    const event = await this.eventOrganizerService.updateEventStatus(
      id,
      dto.status,
    );
    return { message: "Event status updated successfully", data: event };
  }

  @Patch(":id/rounds/:roundId/status")
  @ApiOperation({ summary: "Update round status" })
  async updateRoundStatus(
    @Param("id", ParseIntPipe) eventId: number,
    @Param("roundId", ParseIntPipe) roundId: number,
    @Body() dto: UpdateRoundStatusDto,
  ) {
    const round = await this.eventOrganizerService.updateRoundStatus(
      eventId,
      roundId,
      dto.status,
    );
    return { message: "Round status updated successfully", data: round };
  }

  @Patch(":id/rounds/:roundId/deadline")
  @ApiOperation({ summary: "Update round submission deadline" })
  async updateRoundDeadline(
    @Param("id", ParseIntPipe) eventId: number,
    @Param("roundId", ParseIntPipe) roundId: number,
    @Body() dto: { submissionDeadline: string },
  ) {
    const round = await this.eventOrganizerService.updateRoundDeadline(
      eventId,
      roundId,
      dto.submissionDeadline,
    );
    return { message: "Round deadline updated successfully", data: round };
  }

  @Patch(":id/rounds/:roundId/problem-file")
  @ApiOperation({ summary: "Update round problem statement / topic file attachment" })
  async updateRoundProblemFile(
    @Param("id", ParseIntPipe) eventId: number,
    @Param("roundId", ParseIntPipe) roundId: number,
    @Body() dto: { problemFileUrl?: string | null },
  ) {
    const round = await this.eventOrganizerService.updateRoundProblemFile(
      eventId,
      roundId,
      dto.problemFileUrl ?? null,
    );
    return { message: "Round problem file updated successfully", data: round };
  }

  @Get(":id/submissions")
  @ApiOperation({ summary: "Get all submissions for an event" })
  async getSubmissionsByEvent(
    @Param("id", ParseIntPipe) eventId: number,
    @Query("trackId") trackId?: string,
    @Query("roundId") roundId?: string,
  ) {
    const submissions = await this.eventOrganizerService.getSubmissionsByEvent(
      eventId,
      trackId ? Number(trackId) : undefined,
      roundId ? Number(roundId) : undefined,
    );
    return { message: "Submissions fetched", data: submissions };
  }

  @Get(":id/rounds/:roundId/rankings")
  @ApiOperation({ summary: "Get team rankings for a round by track" })
  async getRoundRankings(
    @Param("id", ParseIntPipe) eventId: number,
    @Param("roundId", ParseIntPipe) roundId: number,
    @Query("trackId") trackId?: string,
  ) {
    const rankings = await this.roundRankingService.getRoundRankings(
      eventId,
      roundId,
      trackId ? Number(trackId) : undefined,
    );
    return { message: "Round rankings fetched", data: rankings };
  }

  @Get(":id/rounds/:roundId/rankings/detailed")
  @ApiOperation({
    summary: "Get detailed team rankings and analytics for a round by track",
  })
  async getDetailedRoundRankings(
    @Param("id", ParseIntPipe) eventId: number,
    @Param("roundId", ParseIntPipe) roundId: number,
    @Query("trackId") trackId?: string,
  ) {
    const rankings = await this.roundRankingService.getDetailedRoundRankings(
      eventId,
      roundId,
      trackId ? Number(trackId) : undefined,
    );
    return { message: "Detailed round rankings fetched", data: rankings };
  }

  @Post(":id/rounds/:roundId/publish-results")
  @ApiOperation({ summary: "Publish round results and advance top teams" })
  async publishRoundResults(
    @Param("id", ParseIntPipe) eventId: number,
    @Param("roundId", ParseIntPipe) roundId: number,
    @Body() dto: PublishRoundResultsDto,
  ) {
    const result = await this.roundRankingService.publishRoundResults(
      eventId,
      roundId,
      dto,
    );
    return { message: "Round results published successfully", data: result };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete an event" })
  async deleteEvent(@Param("id", ParseIntPipe) id: number) {
    await this.eventOrganizerService.deleteEvent(id);
    return { message: "Event deleted successfully" };
  }
}
