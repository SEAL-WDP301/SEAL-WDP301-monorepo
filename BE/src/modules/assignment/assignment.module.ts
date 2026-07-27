import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma/prisma.module";
import { AssignmentOrganizerController } from "./controllers/assignment.organizer.controller";
import { AssignmentMentorController } from "./controllers/assignment.mentor.controller";
import { AssignmentOrganizerService } from "./services/assignment.organizer.service";
import { AssignmentMentorService } from "./services/assignment.mentor.service";
import { FeedbackModule } from "../feedback/feedback.module";

@Module({
  imports: [PrismaModule, FeedbackModule],
  controllers: [AssignmentOrganizerController, AssignmentMentorController],
  providers: [AssignmentOrganizerService, AssignmentMentorService],
  exports: [AssignmentOrganizerService],
})
export class AssignmentModule {}
