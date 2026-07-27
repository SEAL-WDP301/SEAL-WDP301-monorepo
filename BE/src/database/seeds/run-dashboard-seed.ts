import { NestFactory } from "@nestjs/core";
import { DashboardSeedService } from "./dashboard-seed.service";
import { SeedModule } from "./seed.module";

async function run() {
  const app = await NestFactory.createApplicationContext(SeedModule);
  try {
    await app.get(DashboardSeedService).run();
  } catch (error) {
    console.error("Organizer Dashboard seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
