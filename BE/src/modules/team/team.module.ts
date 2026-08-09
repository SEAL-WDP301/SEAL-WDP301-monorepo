import { Module, forwardRef } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { TeamStudentService } from "./services/team.student.service";
import { TeamRegistrationService } from "./services/team-registration.service";
import { TeamInvitationService } from "./services/team-invitation.service";
import { TeamWorkspaceService } from "./services/team-workspace.service";
import { TeamOrganizerService } from "./services/team.organizer.service";
import { TeamGithubService } from "./services/team-github.service";
import { TeamRegistrationProcessor } from "./queues/team-registration.processor";
import { PrismaModule } from "../../database/prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";
import { MailModule } from "../../core/mail/mail.module";
import { StorageModule } from "../../core/storage/storage.module";
import { GithubModule } from "../../core/github/github.module";
import { EventModule } from "../event/event.module";
import { TeamStudentController } from "./controllers/team.student.controller";
import { TeamOrganizerController } from "./controllers/team.organizer.controller";
import { TeamInvitationPublicController } from "./controllers/team-invitation.public.controller";

@Module({
  imports: [
    PrismaModule,
    MailModule,
    StorageModule,
    GithubModule,
    NotificationModule,
    forwardRef(() => EventModule),
    BullModule.registerQueue({
      name: "team-registration",
    }),
  ],
  controllers: [
    TeamStudentController,
    TeamOrganizerController,
    TeamInvitationPublicController,
  ],
  providers: [
    TeamStudentService,
    TeamRegistrationService,
    TeamInvitationService,
    TeamWorkspaceService,
    TeamOrganizerService,
    TeamGithubService,
    TeamRegistrationProcessor,
  ],
  exports: [
    TeamStudentService,
    TeamRegistrationService,
    TeamInvitationService,
    TeamWorkspaceService,
    TeamOrganizerService,
    TeamGithubService,
    BullModule,
  ],
})
export class TeamModule {}
