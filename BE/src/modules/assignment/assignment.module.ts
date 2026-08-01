import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma/prisma.module";
import { AssignmentOrganizerController } from "./controllers/assignment.organizer.controller";
import { AssignmentMentorController } from "./controllers/assignment.mentor.controller";
import { AssignmentOrganizerService } from "./services/assignment.organizer.service";
import { AssignmentMentorService } from "./services/assignment.mentor.service";
import { MentorAiService } from "./services/mentor.ai.service";
import { FeedbackModule } from "../feedback/feedback.module";
import { SubmissionModule } from "../submission/submission.module";

@Module({
  imports: [PrismaModule, FeedbackModule, SubmissionModule],
  controllers: [AssignmentOrganizerController, AssignmentMentorController],
  providers: [
    AssignmentOrganizerService,
    AssignmentMentorService,
    MentorAiService,
  ],
  exports: [AssignmentOrganizerService],
})
export class AssignmentModule {}
