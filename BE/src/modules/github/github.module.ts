import { forwardRef, Module } from "@nestjs/common";
import { GithubWebhookController } from "./controllers/github.webhook.controller";
import { GithubWebhookService } from "./services/github.webhook.service";
import { EventModule } from "../event/event.module";
import { PrismaModule } from "../../database/prisma/prisma.module";
import { GithubModule as CoreGithubModule } from "../../core/github/github.module";

import { BullModule } from "@nestjs/bullmq";
import { GithubQueueProcessor } from "./queues/github-queue.processor";

@Module({
  imports: [
    forwardRef(() => EventModule),
    PrismaModule,
    CoreGithubModule,
    BullModule.registerQueue({
      name: "github-repo",
    }),
  ],
  controllers: [GithubWebhookController],
  providers: [GithubWebhookService, GithubQueueProcessor],
  exports: [GithubWebhookService, BullModule],
})
export class GithubModule {}
