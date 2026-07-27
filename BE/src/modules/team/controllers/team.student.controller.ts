import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
} from "@nestjs/swagger";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Role } from "../../../common/enums/role.enum";
import { TeamStudentService } from "../services/team.student.service";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RegisterTeamDto } from "../dto/register-team.dto";
import { RegisterIndividualDto } from "../dto/register-individual.dto";

@ApiTags("Student/Teams")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STUDENT)
@Controller("student/teams")
export class TeamStudentController {
  constructor(private readonly teamStudentService: TeamStudentService) {}

  @Get("my-events")
  @ApiOperation({ summary: "List events where the student has a team" })
  async getMyEvents(@CurrentUser("id") userId: string) {
    const data = await this.teamStudentService.getMyEvents(Number(userId));
    return { message: "Student events fetched", data };
  }

  @Get("status/:eventId")
  @ApiOperation({ summary: "Get student registration status for an event" })
  async getRegistrationStatus(
    @Param("eventId", ParseIntPipe) eventId: number,
    @CurrentUser("id") userId: string,
  ) {
    const detail = await this.teamStudentService.getRegistrationStatus(
      eventId,
      Number(userId),
    );
    return { message: "Registration status fetched", data: detail };
  }

  @Post("register/individual/:eventId")
  @ApiOperation({ summary: "Register individually for an event" })
  async registerIndividual(
    @Param("eventId", ParseIntPipe) eventId: number,
    @CurrentUser("id") userId: string,
    @Body() dto: RegisterIndividualDto,
  ) {
    const registration = await this.teamStudentService.registerIndividual(
      Number(userId),
      eventId,
      dto,
    );
    return {
      message: "Individual registration successful",
      data: registration,
    };
  }

  @Post("register/team/:eventId")
  @ApiOperation({ summary: "Register a team for an event" })
  async registerTeam(
    @Param("eventId", ParseIntPipe) eventId: number,
    @CurrentUser("id") userId: string,
    @Body() dto: RegisterTeamDto,
  ) {
    const team = await this.teamStudentService.registerTeam(
      Number(userId),
      eventId,
      dto,
    );
    return { message: "Team registration successful", data: team };
  }

  @Put("register/team/:eventId")
  @ApiOperation({ summary: "Update team registration for an event" })
  async updateTeamRegistration(
    @Param("eventId", ParseIntPipe) eventId: number,
    @CurrentUser("id") userId: string,
    @Body() dto: RegisterTeamDto,
  ) {
    const team = await this.teamStudentService.updateTeamRegistration(
      Number(userId),
      eventId,
      dto,
    );
    return { message: "Team registration updated successfully", data: team };
  }

  @Get("invitations/pending")
  @ApiOperation({ summary: "Get pending team invitations" })
  async getInvitations(@CurrentUser("id") userId: string) {
    const invitations = await this.teamStudentService.getInvitations(
      Number(userId),
    );
    return { message: "Invitations fetched", data: invitations };
  }

  @Post("invitations/:teamId/accept")
  @ApiOperation({ summary: "Accept a team invitation" })
  async acceptInvitation(
    @Param("teamId", ParseIntPipe) teamId: number,
    @CurrentUser("id") userId: string,
  ) {
    const updated = await this.teamStudentService.respondToInvitation(
      Number(userId),
      teamId,
      true,
    );
    return { message: "Invitation accepted", data: updated };
  }

  @Post("invitations/:teamId/reject")
  @ApiOperation({ summary: "Reject a team invitation" })
  async rejectInvitation(
    @Param("teamId", ParseIntPipe) teamId: number,
    @CurrentUser("id") userId: string,
  ) {
    const updated = await this.teamStudentService.respondToInvitation(
      Number(userId),
      teamId,
      false,
    );
    return { message: "Invitation rejected", data: updated };
  }

  @Get("my-team/workspace")
  @ApiOperation({ summary: "Get workspace overview for team" })
  async getWorkspaceOverview(
    @Query("eventId", ParseIntPipe) eventId: number,
    @CurrentUser("id") userId: string,
  ) {
    const data = await this.teamStudentService.getWorkspaceOverview(
      Number(userId),
      eventId,
    );
    return { message: "Workspace overview fetched", data };
  }

  @Get("my-team/feedback")
  @ApiOperation({ summary: "Get mentor feedback for the student's team" })
  async getMentorFeedback(
    @Query("eventId", ParseIntPipe) eventId: number,
    @CurrentUser("id") userId: string,
  ) {
    const data = await this.teamStudentService.getMentorFeedback(
      Number(userId),
      eventId,
    );
    return { message: "Mentor feedback fetched", data };
  }

  @Post(":teamId/transfer-leadership/:newLeaderId")
  @ApiOperation({ summary: "Transfer team leadership to another member" })
  async transferLeadership(
    @Param("teamId", ParseIntPipe) teamId: number,
    @Param("newLeaderId", ParseIntPipe) newLeaderId: number,
    @CurrentUser("id") userId: string,
  ) {
    const updatedTeam = await this.teamStudentService.transferLeadership(
      Number(userId),
      teamId,
      newLeaderId,
    );
    return {
      message: "Leadership transferred successfully",
      data: updatedTeam,
    };
  }
}
