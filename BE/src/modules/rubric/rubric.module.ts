import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma/prisma.module";
import { RubricOrganizerController } from "./controllers/rubric.organizer.controller";
import { RubricOrganizerService } from "./services/rubric.organizer.service";
import { RubricAiService } from "./services/rubric-ai.service";

@Module({
  imports: [PrismaModule],
  controllers: [RubricOrganizerController],
  providers: [RubricOrganizerService, RubricAiService],
  exports: [RubricOrganizerService, RubricAiService],
})
export class RubricModule {}
