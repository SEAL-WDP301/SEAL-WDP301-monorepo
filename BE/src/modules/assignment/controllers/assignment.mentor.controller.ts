import {
  Controller,
  Get,
  Post,
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
import { MentorAiService } from "../services/mentor.ai.service";

@ApiTags("Mentor")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAKEHOLDER)
@Controller("mentor")
export class AssignmentMentorController {
  constructor(
    private readonly assignmentMentorService: AssignmentMentorService,
    private readonly mentorAiService: MentorAiService,
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

  @Post("events/:eventId/ai-overview")
  @ApiOperation({
    summary:
      "AI triage overview of all assigned teams in an event (priority + focus)",
  })
  async aiOverview(
    @CurrentUser("id") mentorId: number,
    @Param("eventId", ParseIntPipe) eventId: number,
  ) {
    return {
      message: "Mentor AI overview generated",
      data: await this.mentorAiService.portfolioOverview(mentorId, eventId),
    };
  }

  @Post("submissions/:submissionId/ai-draft")
  @ApiOperation({
    summary:
      "AI mentoring draft for one submission (overview + questions + feedback text)",
  })
  async aiDraft(
    @CurrentUser("id") mentorId: number,
    @Param("submissionId", ParseIntPipe) submissionId: number,
  ) {
    return {
      message: "Mentor AI draft generated",
      data: await this.mentorAiService.draftFeedback(mentorId, submissionId),
    };
  }
}
