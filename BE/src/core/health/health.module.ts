import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";

/**
 * HealthModule — provides system health check endpoint.
 * RedisService is available globally (from RedisModule @Global).
 * DataSource is provided by TypeOrmModule (global).
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
