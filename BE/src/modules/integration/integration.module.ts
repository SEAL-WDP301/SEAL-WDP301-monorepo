import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";
import { GoogleCalendarController } from "./controllers/google-calendar.controller";
import { GoogleCalendarMeetingController } from "./controllers/google-calendar-meeting.controller";
import { GoogleCalendarParticipantController } from "./controllers/google-calendar-participant.controller";
import { GoogleCalendarService } from "./services/google-calendar.service";

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [
    GoogleCalendarController,
    GoogleCalendarMeetingController,
    GoogleCalendarParticipantController,
  ],
  providers: [GoogleCalendarService],
  exports: [GoogleCalendarService],
})
export class IntegrationModule {}
