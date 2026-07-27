import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";
import { GithubModule } from "../github/github.module";
import { SubmissionModule } from "../submission/submission.module";
import { TeamModule } from "../team/team.module";
import { MailModule } from "../../core/mail/mail.module";
import { RoundAutomationSchedulerService } from "./services/round-automation-scheduler.service";
import { RoundRankingService } from "../event/services/round-ranking.service";

import { BullModule } from "@nestjs/bullmq";
import { RoundQueueProcessor } from "./queues/round-queue.processor";

@Module({
  imports: [
    PrismaModule,
    NotificationModule,
    GithubModule,
    SubmissionModule,
    TeamModule,
    MailModule,
    BullModule.registerQueue({
      name: "round-automation",
    }),
  ],
  providers: [RoundAutomationSchedulerService, RoundRankingService, RoundQueueProcessor],
  exports: [RoundAutomationSchedulerService, RoundRankingService, BullModule],
})
export class RoundModule {}
