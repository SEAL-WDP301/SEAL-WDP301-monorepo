import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { NotificationService } from "../../notification/services/notification.service";
import { GoogleCalendarService } from "./google-calendar.service";

describe("GoogleCalendarService OAuth callback", () => {
  const prisma = {
    googleOAuthState: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    googleCalendarConnection: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        GOOGLE_CALENDAR_CLIENT_ID: "client-id",
        GOOGLE_CALENDAR_CLIENT_SECRET: "client-secret",
        GOOGLE_CALENDAR_REDIRECT_URI: "https://example.com/callback",
        GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY:
          "stable-test-encryption-key-at-least-32-characters",
      };
      return values[key];
    }),
  };
  const service = new GoogleCalendarService(
    config as unknown as ConfigService,
    prisma as unknown as PrismaService,
    {} as NotificationService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.googleOAuthState.findUnique.mockResolvedValue({
      id: "oauth-state",
      userId: 42,
      expiresAt: new Date(Date.now() + 60_000),
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it("removes an unreadable stored token instead of reporting a successful reconnect", async () => {
    prisma.googleCalendarConnection.findUnique.mockResolvedValue({
      userId: 42,
      refreshTokenEncrypted: "encrypted-with-an-old-key",
      scope: "calendar.events",
    });
    jest
      .spyOn(
        service as unknown as {
          createOAuthClient: () => {
            getToken: (code: string) => Promise<{ tokens: object }>;
          };
        },
        "createOAuthClient",
      )
      .mockReturnValue({
        getToken: jest.fn().mockResolvedValue({
          tokens: { scope: "calendar.events" },
        }),
      });

    await expect(
      service.handleCallback("authorization-code", "oauth-state"),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.googleCalendarConnection.delete).toHaveBeenCalledWith({
      where: { userId: 42 },
    });
    expect(prisma.googleCalendarConnection.upsert).not.toHaveBeenCalled();
  });

  it("resets an unreadable connection as soon as a calendar client is requested", async () => {
    prisma.googleCalendarConnection.findUnique.mockResolvedValue({
      userId: 42,
      refreshTokenEncrypted: "encrypted-with-an-old-key",
      scope: "calendar.events",
    });

    await expect(
      (
        service as unknown as {
          createCalendarClient: (userId: number) => Promise<unknown>;
        }
      ).createCalendarClient(42),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.googleCalendarConnection.delete).toHaveBeenCalledWith({
      where: { userId: 42 },
    });
  });
});
