import { NestFactory } from "@nestjs/core";
import { SeedModule } from "./seed.module";
import { MockEventService } from "./mock-event.service";

async function run() {
  const app = await NestFactory.createApplicationContext(SeedModule);
  const service = app.get(MockEventService);
  try {
    await service.run();
    console.log("Mock event seeding completed successfully!");
  } catch (error) {
    console.error("Mock event seeding failed:", error);
  } finally {
    await app.close();
  }
}

run();
