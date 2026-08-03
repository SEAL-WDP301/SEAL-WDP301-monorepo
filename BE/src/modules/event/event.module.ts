import { Module, forwardRef } from "@nestjs/common";
import { EventOrganizerController } from "./controllers/event.organizer.controller";
import { EventPublicController } from "./controllers/event.public.controller";
import { EventOrganizerService } from "./services/event.organizer.service";
import { EventPublicService } from "./services/event.public.service";
import { EventJudgeController } from "./controllers/event.judge.controller";
import { EventJudgeService } from "./services/event.judge.service";
import { RoundRankingService } from "./services/round-ranking.service";
import { TrackAssignmentService } from "./services/track-assignment.service";
import { PrismaModule } from "../../database/prisma/prisma.module";
import { MailModule } from "../../core/mail/mail.module";
import { TeamModule } from "../team/team.module";
import { AdminRealtimeGateway } from "./gateways/admin-realtime.gateway";
import { AdminRealtimeSseController } from "./controllers/admin-realtime-sse.controller";
import { AdminRealtimeSseService } from "./services/admin-realtime-sse.service";
import { NotificationModule } from "../notification/notification.module";

import { RoundModule } from "../round/round.module";

@Module({
  imports: [
    PrismaModule,
    MailModule,
    TeamModule,
    NotificationModule,
    forwardRef(() => RoundModule),
  ],
  controllers: [
    EventOrganizerController,
    EventPublicController,
    EventJudgeController,
    AdminRealtimeSseController,
  ],
  providers: [
    EventOrganizerService,
    EventPublicService,
    RoundRankingService,
    TrackAssignmentService,
    EventJudgeService,
    AdminRealtimeGateway,
    AdminRealtimeSseService,
  ],
  exports: [
    EventOrganizerService,
    EventPublicService,
    RoundRankingService,
    TrackAssignmentService,
    AdminRealtimeGateway,
    AdminRealtimeSseService,
  ],
})
export class EventModule {}
