import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { PrismaService } from "../../database/prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Check system health status" })
  @ApiResponse({
    status: 200,
    description: "System health report",
    schema: {
      example: {
        success: true,
        status: "ok",
        database: "connected",
        redis: "connected",
        uptime: 123.45,
        timestamp: "2024-01-01T00:00:00.000Z",
      },
    },
  })
  async check() {
    // ─── Database Health ─────────────────────────────────────────────────────
    let databaseStatus = "disconnected";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseStatus = "connected";
    } catch {
      databaseStatus = "error";
    }

    // ─── Redis Health ─────────────────────────────────────────────────────────
    const isRedisConnected = await this.redisService.ping();
    const redisStatus = isRedisConnected ? "connected" : "disconnected";

    // ─── Overall Status ───────────────────────────────────────────────────────
    const isHealthy = databaseStatus === "connected" && isRedisConnected;

    return {
      message: isHealthy ? "All systems operational" : "Some systems degraded",
      data: {
        status: isHealthy ? "ok" : "degraded",
        database: databaseStatus,
        redis: redisStatus,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    };
  }
}
