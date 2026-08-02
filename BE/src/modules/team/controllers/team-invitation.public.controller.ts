import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { TeamStudentService } from "../services/team.student.service";

@ApiTags("Public/Team Invitations")
@Controller("public/team-invitations")
export class TeamInvitationPublicController {
  constructor(private readonly teamStudentService: TeamStudentService) {}

  @Get(":token")
  @ApiOperation({ summary: "Get a team invitation from its email token" })
  async getInvitation(@Param("token") token: string) {
    const invitation =
      await this.teamStudentService.getInvitationByToken(token);
    return { message: "Invitation fetched", data: invitation };
  }
}
