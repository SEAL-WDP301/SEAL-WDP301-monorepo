import { registerAs } from "@nestjs/config";

/**
 * Redis configuration namespace: 'redis'
 * Used by ioredis for cache and future scalability (pub/sub, queues).
 */
export default registerAs("redis", () => ({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),

  /** Optional password for Redis AUTH */
  password: process.env.REDIS_PASSWORD || undefined,

  /** Connection timeout in ms */
  connectTimeout: 10000,

  /** Enable keep-alive */
  keepAlive: 10000,
}));
