import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Role } from "../../../common/enums/role.enum";
import { EventJudgeService } from "../services/event.judge.service";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@ApiTags("Judge/Events")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAKEHOLDER, Role.ADMIN)
@Controller("judge/events")
export class EventJudgeController {
  constructor(private readonly eventJudgeService: EventJudgeService) {}

  @Get()
  @ApiOperation({ summary: "Get events and rounds assigned to the judge" })
  async getAssignedEvents(@CurrentUser("id") userId: string) {
    const events = await this.eventJudgeService.getAssignedEvents(
      Number(userId),
    );
    return { message: "Assigned events fetched", data: events };
  }
}
