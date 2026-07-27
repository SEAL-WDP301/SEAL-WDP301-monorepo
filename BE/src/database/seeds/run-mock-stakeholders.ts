import { NestFactory } from "@nestjs/core";
import { SeedModule } from "./seed.module";
import { MockStakeholdersService } from "./mock-stakeholders.service";

async function run() {
  const app = await NestFactory.createApplicationContext(SeedModule);
  const service = app.get(MockStakeholdersService);
  try {
    await service.run();
    console.log("Mock stakeholders seeding completed successfully!");
  } catch (error: any) {
    console.error("Mock stakeholders seeding failed:", error.message || error);
  } finally {
    await app.close();
  }
}

run();
