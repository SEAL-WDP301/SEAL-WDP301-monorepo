import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Role } from "../../../common/enums/role.enum";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { GoogleCalendarService } from "../services/google-calendar.service";

@ApiTags("Student/Events/Online Meeting")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STUDENT)
@Controller("student/events")
export class GoogleCalendarParticipantController {
  constructor(private readonly service: GoogleCalendarService) {}

  @Get(":eventId/online-meeting")
  @ApiOperation({ summary: "Get the online meeting for an event participant" })
  async getOnlineMeeting(
    @CurrentUser("id") userId: string,
    @Param("eventId", ParseIntPipe) eventId: number,
  ) {
    return {
      message: "Online meeting retrieved",
      data: await this.service.getParticipantMeeting(Number(userId), eventId),
    };
  }
}
