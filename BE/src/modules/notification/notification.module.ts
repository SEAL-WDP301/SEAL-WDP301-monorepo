import { Module } from "@nestjs/common";
import { NotificationController } from "./controllers/notification.controller";
import { NotificationService } from "./services/notification.service";
import { PrismaModule } from "../../database/prisma/prisma.module";

import { BullModule } from "@nestjs/bullmq";
import { MailModule } from "../../core/mail/mail.module";
import { NotificationQueueProcessor } from "./queues/notification-queue.processor";

@Module({
  imports: [
    PrismaModule,
    MailModule,
    BullModule.registerQueue({
      name: "mail-notification",
    }),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationQueueProcessor],
  exports: [NotificationService, BullModule],
})
export class NotificationModule {}
