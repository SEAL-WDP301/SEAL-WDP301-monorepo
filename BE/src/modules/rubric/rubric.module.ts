import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma/prisma.module";
import { RubricOrganizerController } from "./controllers/rubric.organizer.controller";
import { RubricOrganizerService } from "./services/rubric.organizer.service";

@Module({
  imports: [PrismaModule],
  controllers: [RubricOrganizerController],
  providers: [RubricOrganizerService],
  exports: [RubricOrganizerService],
})
export class RubricModule {}
