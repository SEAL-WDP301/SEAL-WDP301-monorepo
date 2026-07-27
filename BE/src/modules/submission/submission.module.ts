import { Module } from "@nestjs/common";
import { SubmissionJudgeController } from "./controllers/submission.judge.controller";
import { SubmissionJudgeService } from "./services/submission.judge.service";
import { PrismaModule } from "../../database/prisma/prisma.module";
import { SubmissionStudentController } from "./controllers/submission.student.controller";
import { SubmissionStudentService } from "./services/submission.student.service";
import { SubmissionOrganizerController } from "./controllers/submission.organizer.controller";
import { SubmissionOrganizerService } from "./services/submission.organizer.service";
import { StorageModule } from "../../core/storage/storage.module";
import { NotificationModule } from "../notification/notification.module";
import { MailModule } from "../../core/mail/mail.module";

import { BullModule } from "@nestjs/bullmq";

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    NotificationModule,
    MailModule,
    BullModule.registerQueue({
      name: "mail-notification",
    }),
  ],
  controllers: [SubmissionJudgeController, SubmissionStudentController, SubmissionOrganizerController],
  providers: [SubmissionJudgeService, SubmissionStudentService, SubmissionOrganizerService],
  exports: [SubmissionJudgeService, SubmissionStudentService, SubmissionOrganizerService],
})
export class SubmissionModule {}
