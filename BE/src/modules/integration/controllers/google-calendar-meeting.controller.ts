import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Role } from "../../../common/enums/role.enum";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { SyncGoogleCalendarMeetingDto } from "../dto/sync-google-calendar-meeting.dto";
import { GoogleCalendarService } from "../services/google-calendar.service";

@ApiTags("Organizer/Events/Google Calendar")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER, Role.ADMIN)
@Controller("organizer/events")
export class GoogleCalendarMeetingController {
  constructor(private readonly service: GoogleCalendarService) {}

  @Post(":eventId/calendar-meeting")
  @ApiOperation({ summary: "Create or update an event's Google Meet" })
  async syncMeeting(
    @CurrentUser("id") userId: string,
    @Param("eventId", ParseIntPipe) eventId: number,
    @Body() dto: SyncGoogleCalendarMeetingDto,
  ) {
    return {
      message: "Google Calendar meeting synchronized",
      data: await this.service.syncMeeting(Number(userId), eventId, dto),
    };
  }

  @Patch(":eventId/calendar-meeting")
  @ApiOperation({ summary: "Update an event's Google Calendar meeting" })
  async updateMeeting(
    @CurrentUser("id") userId: string,
    @Param("eventId", ParseIntPipe) eventId: number,
    @Body() dto: SyncGoogleCalendarMeetingDto,
  ) {
    return {
      message: "Google Calendar meeting updated",
      data: await this.service.syncMeeting(Number(userId), eventId, dto),
    };
  }

  @Delete(":eventId/calendar-meeting")
  @ApiOperation({ summary: "Delete an event's Google Calendar meeting" })
  async deleteMeeting(
    @CurrentUser("id") userId: string,
    @Param("eventId", ParseIntPipe) eventId: number,
  ) {
    await this.service.deleteMeeting(Number(userId), eventId);
    return { message: "Google Calendar meeting deleted" };
  }
}
