import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Role } from "../../../common/enums/role.enum";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { AssignmentMentorService } from "../services/assignment.mentor.service";

@ApiTags("Mentor")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAKEHOLDER)
@Controller("mentor")
export class AssignmentMentorController {
  constructor(
    private readonly assignmentMentorService: AssignmentMentorService,
  ) {}

  @Get("teams")
  @ApiOperation({ summary: "Get teams assigned to the current mentor" })
  async getTeams(
    @CurrentUser("id") mentorId: number,
    @Query("eventId") eventId?: string,
  ) {
    return {
      message: "Mentor teams fetched",
      data: await this.assignmentMentorService.getTeams(
        mentorId,
        eventId ? Number(eventId) : undefined,
      ),
    };
  }

  @Get("teams/:teamId")
  @ApiOperation({ summary: "Get an assigned team by ID" })
  async getTeamById(
    @CurrentUser("id") mentorId: number,
    @Param("teamId", ParseIntPipe) teamId: number,
  ) {
    return {
      message: "Mentor team fetched",
      data: await this.assignmentMentorService.getTeamById(mentorId, teamId),
    };
  }

  @Get("teams/:teamId/submissions")
  @ApiOperation({ summary: "Get submissions of an assigned team" })
  async getTeamSubmissions(
    @CurrentUser("id") mentorId: number,
    @Param("teamId", ParseIntPipe) teamId: number,
  ) {
    return {
      message: "Team submissions fetched",
      data: await this.assignmentMentorService.getTeamSubmissions(
        mentorId,
        teamId,
      ),
    };
  }

  @Get("submissions")
  @ApiOperation({ summary: "Get submissions from all assigned teams" })
  async getSubmissions(
    @CurrentUser("id") mentorId: number,
    @Query("eventId") eventId?: string,
  ) {
    return {
      message: "Mentor submissions fetched",
      data: await this.assignmentMentorService.getSubmissions(
        mentorId,
        eventId ? Number(eventId) : undefined,
      ),
    };
  }

  @Get("submissions/:submissionId")
  @ApiOperation({ summary: "Get an assigned team's submission by ID" })
  async getSubmissionById(
    @CurrentUser("id") mentorId: number,
    @Param("submissionId", ParseIntPipe) submissionId: number,
  ) {
    return {
      message: "Mentor submission fetched",
      data: await this.assignmentMentorService.getSubmissionById(
        mentorId,
        submissionId,
      ),
    };
  }
}
