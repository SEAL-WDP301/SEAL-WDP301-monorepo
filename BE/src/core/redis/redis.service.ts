import { Injectable, Inject, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { Observable } from "rxjs";
import { APP_CONSTANTS } from "../../common/constants/app.constant";

/**
 * RedisService — abstraction layer over raw ioredis client.
 *
 * Provides clean async methods for common Redis operations
 * including Key-Value cache, rate limiting, and Pub/Sub streams.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private subClient: Redis | null = null;

  constructor(
    @Inject(APP_CONSTANTS.REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  onModuleDestroy() {
    if (this.subClient) {
      this.subClient.disconnect();
    }
  }

  /**
   * Publish a message to a Redis Pub/Sub channel.
   */
  async publish(channel: string, message: string): Promise<number> {
    return this.redis.publish(channel, message);
  }

  /**
   * Subscribe to a Redis channel and stream messages as an RxJS Observable.
   * Automatically unsubscribes when the RxJS subscriber disconnects.
   */
  subscribeChannel(channel: string): Observable<string> {
    if (!this.subClient) {
      this.subClient = this.redis.duplicate();
    }
    const sub = this.subClient;

    return new Observable<string>((observer) => {
      const messageHandler = (ch: string, message: string) => {
        if (ch === channel) {
          observer.next(message);
        }
      };

      sub.subscribe(channel).catch((err) => observer.error(err));
      sub.on("message", messageHandler);

      return () => {
        sub.off("message", messageHandler);
        sub.unsubscribe(channel).catch(() => {});
      };
    });
  }

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
