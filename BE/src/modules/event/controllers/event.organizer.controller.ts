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
  Sse,
  MessageEvent,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Observable } from "rxjs";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Role } from "../../../common/enums/role.enum";
import { EventOrganizerService } from "../services/event.organizer.service";
import { RoundRankingService } from "../services/round-ranking.service";
import { AdminRealtimeSseService } from "../services/admin-realtime-sse.service";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CreateEventDto } from "../dto/create-event.dto";
import { UpdateEventDto } from "../dto/update-event.dto";
import { UpdateEventStatusDto } from "../dto/update-event-status.dto";
import { UpdateRoundStatusDto } from "../dto/update-round-status.dto";

import { PublishRoundResultsDto } from "../dto/publish-round-results.dto";
import { CreateProblemPoolItemDto } from "../dto/create-problem-pool-item.dto";
import { RevealTracksDto } from "../dto/reveal-tracks.dto";
import { ProblemPoolService } from "../services/problem-pool.service";
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
    private readonly adminRealtimeSseService: AdminRealtimeSseService,
    private readonly problemPoolService: ProblemPoolService,
  ) {}

  @Sse(":eventId/stream")
  @ApiOperation({
    summary: "Stream real-time event updates (team registrations) for Organizer/Admin via SSE",
  })
  @ApiResponse({ status: 200, description: "Event SSE stream established" })
  streamEventUpdates(
    @Param("eventId", ParseIntPipe) eventId: number,
  ): Observable<MessageEvent> {
    return this.adminRealtimeSseService.streamEventUpdates(
      eventId,
    ) as Observable<MessageEvent>;
  }

  @Sse("rounds/:roundId/stream")
  @ApiOperation({
    summary: "Stream real-time round updates (submissions) for Organizer/Admin via SSE",
  })
  @ApiResponse({ status: 200, description: "Round SSE stream established" })
  streamRoundUpdates(
    @Param("roundId", ParseIntPipe) roundId: number,
  ): Observable<MessageEvent> {
    return this.adminRealtimeSseService.streamRoundUpdates(
      roundId,
    ) as Observable<MessageEvent>;
  }

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

  @Patch(":id/registration-deadline")
  @ApiOperation({
    summary:
      "Update event registration deadline and reschedule BullMQ delayed job",
  })
  async updateRegistrationDeadline(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: { registrationDeadline: string },
  ) {
    const event = await this.eventOrganizerService.updateRegistrationDeadline(
      id,
      dto.registrationDeadline,
    );
    return {
      message: "Registration deadline updated successfully",
      data: event,
    };
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
  @ApiOperation({
    summary:
      "Update round problem file. Pass trackId for per-track đề when round is track-specific.",
  })
  async updateRoundProblemFile(
    @Param("id", ParseIntPipe) eventId: number,
    @Param("roundId", ParseIntPipe) roundId: number,
    @Body() dto: { problemFileUrl?: string | null; trackId?: number | null },
  ) {
    const round = await this.eventOrganizerService.updateRoundProblemFile(
      eventId,
      roundId,
      dto.problemFileUrl ?? null,
      dto.trackId,
    );
    return { message: "Round problem file updated successfully", data: round };
  }

  @Post(":id/rounds/:roundId/tracks")
  @ApiOperation({
    summary:
      "Create a track scoped to this round only (works while this round is not_started, regardless of other rounds).",
  })
  async createRoundTrack(
    @Param("id", ParseIntPipe) eventId: number,
    @Param("roundId", ParseIntPipe) roundId: number,
    @Body() dto: { name: string; description?: string },
  ) {
    const data = await this.eventOrganizerService.createRoundTrack(
      eventId,
      roundId,
      dto,
    );
    return { message: "Track created for round", data };
  }

  @Patch(":id/tracks/:trackId")
  @ApiOperation({ summary: "Update track name/description" })
  async updateTrackMetadata(
    @Param("id", ParseIntPipe) eventId: number,
    @Param("trackId", ParseIntPipe) trackId: number,
    @Body() dto: { name: string; description?: string },
  ) {
    const data = await this.eventOrganizerService.updateTrackMetadata(
      eventId,
      trackId,
      dto,
    );
    return { message: "Track updated", data };
  }

  @Delete(":id/rounds/:roundId/tracks/:trackId")
  @ApiOperation({
    summary:
      "Remove a track from a round's scope (unscope). Does not delete the track itself.",
  })
  async removeTrackFromRound(
    @Param("id", ParseIntPipe) eventId: number,
    @Param("roundId", ParseIntPipe) roundId: number,
    @Param("trackId", ParseIntPipe) trackId: number,
  ) {
    const data = await this.eventOrganizerService.removeTrackFromRound(
      eventId,
      roundId,
      trackId,
    );
    return { message: "Track removed from round successfully", data };
  }

  @Post(":id/tracks/reveal")
  @ApiOperation({
    summary:
      "Phase 2: bulk assign tracks, or open student self-draw when studentSelfDraw is true in the body.",
  })
  async revealTracks(
    @Param("id", ParseIntPipe) eventId: number,
    @Body() dto?: RevealTracksDto,
  ) {
    const data = await this.eventOrganizerService.revealTracks(
      eventId,
      Boolean(dto?.forceReassign),
      dto?.roundId,
      dto?.studentSelfDraw,
    );
    return { message: "Tracks revealed successfully", data };
  }

  @Post(":id/tracks/close-student-draw")
  @ApiOperation({ summary: "Close student self-draw phase (Flow B)" })
  async closeStudentTrackDraw(@Param("id", ParseIntPipe) eventId: number) {
    const data = await this.eventOrganizerService.closeStudentTrackDraw(eventId);
    return { message: "Student track draw closed", data };
  }

  @Get(":id/tracks/draw-status")
  @ApiOperation({ summary: "Live status for student self-draw (projector board)" })
  async getStudentTrackDrawStatus(
    @Param("id", ParseIntPipe) eventId: number,
    @Query("roundId") roundId?: string,
  ) {
    const data = await this.eventOrganizerService.getStudentTrackDrawStatus(
      eventId,
      roundId ? Number(roundId) : undefined,
    );
    return { message: "Track draw status", data };
  }

  @Get(":id/problem-pool")
  @ApiOperation({ summary: "List secret problem pool items for an event" })
  async listProblemPool(@Param("id", ParseIntPipe) eventId: number) {
    const data = await this.problemPoolService.listPoolItems(eventId);
    return { message: "Problem pool fetched", data };
  }

  @Post(":id/problem-pool")
  @ApiOperation({ summary: "Add a problem to the secret pool" })
  async addProblemPoolItem(
    @Param("id", ParseIntPipe) eventId: number,
    @Body() dto: CreateProblemPoolItemDto,
  ) {
    const data = await this.problemPoolService.addPoolItem(eventId, dto);
    return { message: "Problem pool item added", data };
  }

  @Delete(":id/problem-pool/:itemId")
  @ApiOperation({ summary: "Remove an unassigned pool item" })
  async removeProblemPoolItem(
    @Param("id", ParseIntPipe) eventId: number,
    @Param("itemId", ParseIntPipe) itemId: number,
  ) {
    const data = await this.problemPoolService.removePoolItem(eventId, itemId);
    return { message: "Problem pool item removed", data };
  }

  @Post(":id/rounds/:roundId/lottery-problems")
  @ApiOperation({
    summary:
      "Randomly assign pool problems to tracks in a round (ceremony Phase 1)",
  })
  async lotteryAssignProblems(
    @Param("id", ParseIntPipe) eventId: number,
    @Param("roundId", ParseIntPipe) roundId: number,
  ) {
    const data = await this.problemPoolService.lotteryAssignProblemsToRound(
      eventId,
      roundId,
    );
    return { message: "Problems assigned to tracks", data };
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
