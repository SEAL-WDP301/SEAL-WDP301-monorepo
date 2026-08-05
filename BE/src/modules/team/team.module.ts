import { Module, forwardRef } from "@nestjs/common";
import { TeamStudentService } from "./services/team.student.service";
import { TeamOrganizerService } from "./services/team.organizer.service";
import { TeamGithubService } from "./services/team-github.service";
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
  ],
  controllers: [
    TeamStudentController,
    TeamOrganizerController,
    TeamInvitationPublicController,
  ],
  providers: [TeamStudentService, TeamOrganizerService, TeamGithubService],
  exports: [TeamStudentService, TeamOrganizerService, TeamGithubService],
})
export class TeamModule {}
