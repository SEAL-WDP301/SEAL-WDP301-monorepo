import { NestFactory } from "@nestjs/core";
import { SeedModule } from "./seed.module";
import { MockTeamsService } from "./mock-teams.service";

async function run() {
  const app = await NestFactory.createApplicationContext(SeedModule);
  const service = app.get(MockTeamsService);
  try {
    const args = process.argv.slice(2);
    const eventIdArg = args.find((arg) => !arg.startsWith("-"));
    const eventId = parseInt(eventIdArg || "", 10);

    if (isNaN(eventId)) {
      throw new Error(
        "Vui lòng cung cấp eventId hợp lệ. Cú pháp: npm run seed:mock-teams -- 10",
      );
    }

    await service.run(eventId);
    console.log("Mock teams seeding completed successfully!");
  } catch (error: any) {
    console.error("Mock teams seeding failed:", error.message || error);
  } finally {
    await app.close();
  }
}

run();
