import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma/prisma.module";
import { AnalyticsOrganizerController } from "./controllers/analytics.organizer.controller";
import { RegistrationsOrganizerController } from "./controllers/registrations.organizer.controller";
import { AnalyticsOrganizerRepository } from "./repositories/analytics.organizer.repository";
import { AnalyticsOrganizerService } from "./services/analytics.organizer.service";
import { OrganizerEventAccessService } from "./services/organizer-event-access.service";
import { RegistrationsOrganizerService } from "./services/registrations.organizer.service";

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsOrganizerController, RegistrationsOrganizerController],
  providers: [
    AnalyticsOrganizerService,
    AnalyticsOrganizerRepository,
    OrganizerEventAccessService,
    RegistrationsOrganizerService,
  ],
  exports: [OrganizerEventAccessService],
})
export class AnalyticsModule {}
