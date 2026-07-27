import { Module } from "@nestjs/common";
import { EventOrganizerController } from "./controllers/event.organizer.controller";
import { EventPublicController } from "./controllers/event.public.controller";
import { EventOrganizerService } from "./services/event.organizer.service";
import { EventPublicService } from "./services/event.public.service";
import { EventJudgeController } from "./controllers/event.judge.controller";
import { EventJudgeService } from "./services/event.judge.service";
import { RoundRankingService } from "./services/round-ranking.service";
import { PrismaModule } from "../../database/prisma/prisma.module";
import { MailModule } from "../../core/mail/mail.module";
import { TeamModule } from "../team/team.module";
import { AdminRealtimeGateway } from "./gateways/admin-realtime.gateway";
import { NotificationModule } from "../notification/notification.module";

import { RoundModule } from "../round/round.module";

@Module({
  imports: [PrismaModule, MailModule, TeamModule, NotificationModule, RoundModule],
  controllers: [
    EventOrganizerController,
    EventPublicController,
    EventJudgeController,
  ],
  providers: [
    EventOrganizerService,
    EventPublicService,
    RoundRankingService,
    EventJudgeService,
    AdminRealtimeGateway,
  ],
  exports: [
    EventOrganizerService,
    EventPublicService,
    RoundRankingService,
    AdminRealtimeGateway,
  ],
})
export class EventModule {}
