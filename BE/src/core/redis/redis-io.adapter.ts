import { IoAdapter } from "@nestjs/platform-socket.io";
import { ServerOptions } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import Redis from "ioredis";

/**
 * RedisIoAdapter — Enables multi-pod / cluster Redis Pub/Sub for Socket.IO.
 *
 * Allows real-time WebSocket messages to be broadcast seamlessly across
 * multiple load-balanced NestJS Backend replicas (Pods) on Kubernetes.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly logger = new Logger(RedisIoAdapter.name);

  constructor(app: any, private readonly configService: ConfigService) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const host = this.configService.get<string>("redis.host") || "localhost";
    const port = this.configService.get<number>("redis.port") || 6379;
    const password =
      this.configService.get<string>("redis.password") || undefined;

    const pubClient = new Redis({
      host,
      port,
      password,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]).catch((err) => {
      this.logger.error(`Failed to connect RedisIoAdapter: ${err.message}`);
    });

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log(`🚀 Socket.IO Redis Pub/Sub Adapter initialized (${host}:${port})`);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
