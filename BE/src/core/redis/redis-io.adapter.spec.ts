import Redis from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import { RedisIoAdapter } from "./redis-io.adapter";

jest.mock("ioredis", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("@socket.io/redis-adapter", () => ({
  createAdapter: jest.fn().mockReturnValue(jest.fn()),
}));

describe("RedisIoAdapter", () => {
  it("creates lazy clients before explicitly connecting them", async () => {
    const pubConnect = jest.fn().mockResolvedValue(undefined);
    const subConnect = jest.fn().mockResolvedValue(undefined);
    const subClient = { connect: subConnect };
    const pubClient = {
      connect: pubConnect,
      duplicate: jest.fn().mockReturnValue(subClient),
    };
    const RedisMock = Redis as unknown as jest.Mock;
    RedisMock.mockImplementation(() => pubClient);
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "redis.host") return "redis.internal";
        if (key === "redis.port") return 6380;
        return undefined;
      }),
    };
    const adapter = new RedisIoAdapter({} as never, configService as never);

    await adapter.connectToRedis();

    expect(RedisMock).toHaveBeenCalledWith(
      expect.objectContaining({ lazyConnect: true }),
    );
    expect(pubConnect).toHaveBeenCalledTimes(1);
    expect(subConnect).toHaveBeenCalledTimes(1);
    expect(createAdapter).toHaveBeenCalledWith(pubClient, subClient);
  });
});
