import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { OrganizerEventAccessService } from "./organizer-event-access.service";

describe("OrganizerEventAccessService", () => {
  const prisma = {
    event: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const service = new OrganizerEventAccessService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => jest.clearAllMocks());

  it("only returns events created by the organizer", async () => {
    prisma.event.findMany.mockResolvedValue([{ id: 3 }, { id: 7 }]);
    await expect(service.getAccessibleEventIds(42)).resolves.toEqual([3, 7]);
    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: { createdById: 42 },
      select: { id: true },
    });
  });

  it("distinguishes a missing event from denied access", async () => {
    prisma.event.findUnique.mockResolvedValueOnce(null);
    await expect(service.ensureEventAccess(42, 3)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.event.findUnique.mockResolvedValueOnce({ createdById: 99 });
    await expect(service.ensureEventAccess(42, 3)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
