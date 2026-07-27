import { Injectable, Inject } from "@nestjs/common";
import Redis from "ioredis";
import { APP_CONSTANTS } from "../../common/constants/app.constant";

/**
 * RedisService — abstraction layer over raw ioredis client.
 *
 * Provides clean async methods for common Redis operations.
 * Inject this service instead of the raw client in application code.
 */
@Injectable()
export class RedisService {
  constructor(
    @Inject(APP_CONSTANTS.REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  /**
   * Set a key-value pair with optional TTL (seconds).
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.set(key, value, "EX", ttlSeconds);
    } else {
      await this.redis.set(key, value);
    }
  }

  /**
   * Get value by key. Returns null if not found.
   */
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  /**
   * Delete one or more keys.
   */
  async del(...keys: string[]): Promise<number> {
    return this.redis.del(...keys);
  }

  /**
   * Check if a key exists.
   */
  async exists(key: string): Promise<boolean> {
    const count = await this.redis.exists(key);
    return count > 0;
  }

  /**
   * Get remaining TTL in seconds. Returns -1 (no TTL) or -2 (not found).
   */
  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  /**
   * Set a key only if it does not exist (NX flag). Used for distributed locks.
   * Returns true if key was set, false if already existed.
   */
  async setNx(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const result = await this.redis.set(key, value, "EX", ttlSeconds, "NX");
    return result === "OK";
  }

  /**
   * Increment a numeric key by 1.
   */
  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  /**
   * Check if Redis is reachable. Returns true/false.
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }
}
