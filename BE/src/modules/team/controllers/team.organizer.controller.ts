import {
  Controller,
  Get,
  Post,
  Put,
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
import { TeamOrganizerService } from "../services/team.organizer.service";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { OrganizerUpdateTeamDto } from "../dto/organizer-update-team.dto";

@ApiTags("Organizer/Teams")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER, Role.ADMIN)
@Controller("organizer/teams")
export class TeamOrganizerController {
  constructor(private readonly teamOrganizerService: TeamOrganizerService) {}

  @Get("events/:eventId")
  @ApiOperation({ summary: "Get all teams for an event with filters and pagination" })
  async getTeamsByEvent(
    @Param("eventId", ParseIntPipe) eventId: number,
    @Query("trackId") trackId?: string,
    @Query("roundId") roundId?: string,
    @Query("hasMentor") hasMentor?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("roundStatus") roundStatus?: string,
  ) {
    const result = await this.teamOrganizerService.getTeamsByEvent(
      eventId,
      trackId ? Number(trackId) : undefined,
      roundId ? Number(roundId) : undefined,
      hasMentor,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
      status,
      search,
      roundStatus,
    );
    return { message: "Teams fetched", ...result };
  }

  @Get("events/:eventId/tracks/:trackId")
  @ApiOperation({ summary: "Get all teams for a specific track" })
  async getTeamsByTrack(
    @Param("eventId", ParseIntPipe) eventId: number,
    @Param("trackId", ParseIntPipe) trackId: number,
  ) {
    const teams = await this.teamOrganizerService.getTeamsByTrack(
      eventId,
      trackId,
    );
    return { message: "Teams fetched", data: teams };
  }

  @Put(":teamId/status")
  @ApiOperation({ summary: "Approve or eliminate a team" })
  async updateTeamStatus(
    @Param("teamId", ParseIntPipe) teamId: number,
    @CurrentUser("id") adminId: string,
    @Body() dto: OrganizerUpdateTeamDto,
  ) {
    const updated = await this.teamOrganizerService.updateTeamStatus(
      teamId,
      dto,
      Number(adminId),
    );
    return { message: "Team status updated", data: updated };
  }

  @Post("bulk-delete")
  @ApiOperation({ summary: "Bulk delete teams" })
  async bulkDeleteTeams(@Body() dto: { teamIds: number[] }) {
    await this.teamOrganizerService.bulkDeleteTeams(dto.teamIds);
    return { message: "Teams deleted successfully" };
  }

  @Post("bulk-status")
  @ApiOperation({ summary: "Bulk update status for teams" })
  async bulkUpdateTeamsStatus(
    @Body() dto: { teamIds: number[]; status: string; reason?: string },
    @CurrentUser("id") adminId: string,
  ) {
    await this.teamOrganizerService.bulkUpdateTeamsStatus(
      dto.teamIds,
      dto.status as any,
      dto.reason,
      Number(adminId),
    );
    return { message: "Teams status updated successfully" };
  }
}
