import { Global, Module, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { APP_CONSTANTS } from "../../common/constants/app.constant";
import { RedisService } from "./redis.service";

/**
 * RedisModule — provides a global ioredis client instance.
 *
 * @Global() — any module can inject RedisService without importing RedisModule.
 *
 * Design: custom provider pattern instead of using a library module,
 * giving us full control over ioredis configuration and reconnect strategy.
 */
@Global()
@Module({
  providers: [
    {
      provide: APP_CONSTANTS.REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const client = new Redis({
          host: configService.get<string>("redis.host"),
          port: configService.get<number>("redis.port"),
          password: configService.get<string>("redis.password") || undefined,
          connectTimeout:
            configService.get<number>("redis.connectTimeout") || 10000,
          keepAlive: configService.get<number>("redis.keepAlive") || 10000,

          // Auto-reconnect on connection drop
          retryStrategy: (times: number) => {
            if (times > 10) return null; // Stop retrying after 10 attempts
            return Math.min(times * 100, 3000); // Exponential backoff up to 3s
          },

          // Lazy connect — don't fail app startup if Redis is down
          lazyConnect: false,
        });

        const logger = new Logger("Redis");

        client.on("connect", () => {
          logger.log("Connected successfully");
        });

        client.on("error", (err) => {
          logger.error(`Connection error: ${err.message}`);
        });

        client.on("reconnecting", () => {
          logger.warn("Reconnecting...");
        });

        return client;
      },
    },
    RedisService,
  ],
  exports: [APP_CONSTANTS.REDIS_CLIENT, RedisService],
})
export class RedisModule {}
