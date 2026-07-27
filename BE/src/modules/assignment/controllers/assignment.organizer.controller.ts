// eslint-disable-next-line prettier/prettier
import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Role } from "../../../common/enums/role.enum";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { AssignmentOrganizerService } from "../services/assignment.organizer.service";
import { AssignJudgeDto } from "../dto/assign-judge.dto";
import { AssignMentorDto } from "../dto/assign-mentor.dto";

@ApiTags("Organizer/assignments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER, Role.ADMIN)
@Controller("organizer/assignments")
export class AssignmentOrganizerController {
  // eslint-disable-next-line prettier/prettier
  constructor(private readonly AssignmentOrganizerService: AssignmentOrganizerService) { }

  @Get("events/:eventId")
  // eslint-disable-next-line prettier/prettier
  @ApiOperation({ summary: "Get all stakeholders (mentors, judges) for an event" })
  // eslint-disable-next-line prettier/prettier
  async getStakeholdersByEvent(@Param("eventId", ParseIntPipe) eventId: number) {
    // eslint-disable-next-line prettier/prettier
    const stakeholders = await this.AssignmentOrganizerService.getStakeholdersByEvent(eventId);
    return { message: "stakeholders fetched", data: stakeholders };
  }

  @Post("events/:eventId/judges")
  @ApiOperation({ summary: "Assign judges to a round/track" })
  async assignJudges(
    @Param("eventId", ParseIntPipe) eventId: number,
    @CurrentUser("id") adminId: string,
    @Body() dto: AssignJudgeDto,
  ) {
    const assignment = await this.AssignmentOrganizerService.assignJudges(
      eventId,
      dto.stakeholderIds,
      dto.roundId,
      dto.trackIds,
      Number(adminId),
    );
    return { message: "Judges assigned successfully", data: assignment };
  }

  @Delete("judges/:stakeholderId")
  @ApiOperation({ summary: "Unassign a judge" })
  // eslint-disable-next-line prettier/prettier
  async unassignJudge(@Param("stakeholderId", ParseIntPipe) stakeholderId: number) {
    await this.AssignmentOrganizerService.unassignJudge(stakeholderId);
    return { message: "Judge unassigned successfully" };
  }

  @Post("teams/:teamId/mentors")
  @ApiOperation({ summary: "Assign a mentor to a team" })
  async assignMentor(
    @Param("teamId", ParseIntPipe) teamId: number,
    @CurrentUser("id") adminId: string,
    @Body() dto: AssignMentorDto,
  ) {
    const assignment = await this.AssignmentOrganizerService.assignMentor(
      teamId,
      dto.stakeholderId,
      Number(adminId),
    );
    return { message: "Mentor assigned successfully", data: assignment };
  }

  @Delete("teams/:teamId/mentors/:stakeholderId")
  @ApiOperation({ summary: "Unassign a mentor from a team" })
  async unassignMentor(
    @Param("teamId", ParseIntPipe) teamId: number,
    @Param("stakeholderId", ParseIntPipe) stakeholderId: number,
  ) {
    // eslint-disable-next-line prettier/prettier
    await this.AssignmentOrganizerService.unassignMentor(teamId, stakeholderId);
    return { message: "Mentor unassigned successfully" };
  }

  @Post("events/:eventId/mentors/bulk-assign")
  @ApiOperation({ summary: "Bulk assign a mentor to multiple teams" })
  async bulkAssignMentor(
    @Param("eventId", ParseIntPipe) eventId: number,
    @CurrentUser("id") adminId: string,
    // eslint-disable-next-line prettier/prettier
    @Body() dto: { stakeholderId: number; teamIds: number[] }
  ) {
    const result = await this.AssignmentOrganizerService.bulkAssignMentor(
      dto.stakeholderId,
      dto.teamIds,
      Number(adminId),
    );
    return { message: "Mentor assigned to teams successfully", data: result };
  }
}
