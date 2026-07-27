import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import appConfig from "../../config/app.config";
import databaseConfig from "../../config/database.config";
import { PrismaModule } from "../prisma/prisma.module";
import { SeedService } from "./seed.service";
import { MockEventService } from "./mock-event.service";
import { MockTeamsService } from "./mock-teams.service";
import { MockStakeholdersService } from "./mock-stakeholders.service";
import { DashboardSeedService } from "./dashboard-seed.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.development", ".env"],
      load: [appConfig, databaseConfig],
      cache: true,
    }),
    PrismaModule,
  ],
  providers: [
    SeedService,
    MockEventService,
    MockTeamsService,
    MockStakeholdersService,
    DashboardSeedService,
  ],
})
export class SeedModule {}
