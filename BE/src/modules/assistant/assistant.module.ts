import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AssistantController } from "./controllers/assistant.controller";
import { AssistantAiService } from "./services/assistant.ai.service";
import { AssistantResolverService } from "./services/assistant.resolver.service";
import { AssistantRoleResolverService } from "./services/assistant.role-resolver.service";
import { AssistantService } from "./services/assistant.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AssistantResolverService,
    AssistantRoleResolverService,
    AssistantAiService,
  ],
  exports: [AssistantService],
})
export class AssistantModule {}
