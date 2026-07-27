import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { MentorFeedbackController } from "./controllers/feedback.mentor.controller";
import { MentorFeedbackService } from "./services/feedback.mentor.service";
import { FeedbackGateway } from "./gateways/feedback.gateway";

import { FeedbackStudentController } from "./controllers/feedback.student.controller";
import { FeedbackStudentService } from "./services/feedback.student.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MentorFeedbackController, FeedbackStudentController],
  providers: [MentorFeedbackService, FeedbackGateway, FeedbackStudentService],
  exports: [MentorFeedbackService, FeedbackGateway, FeedbackStudentService],
})
export class FeedbackModule {}
