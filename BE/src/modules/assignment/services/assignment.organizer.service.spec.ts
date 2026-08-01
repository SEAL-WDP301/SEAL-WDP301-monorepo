import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AssignmentOrganizerService } from "./assignment.organizer.service";

describe("AssignmentOrganizerService stakeholder roles", () => {
  const prisma = {
    round: { findUnique: jest.fn() },
    judgeAssignment: { deleteMany: jest.fn(), createMany: jest.fn() },
    mentorAssignment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
    team: { findUnique: jest.fn(), findMany: jest.fn() },
    notification: { create: jest.fn(), createMany: jest.fn() },
  };
  const eventEmitter = { emit: jest.fn() };
  const service = new AssignmentOrganizerService(
    prisma as unknown as PrismaService,
    eventEmitter as unknown as EventEmitter2,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows a mentor to also be assigned as a judge", async () => {
    prisma.round.findUnique.mockResolvedValue({
      id: 7,
      eventId: 3,
      name: "Round 1",
      isTrackSpecific: false,
    });
    prisma.judgeAssignment.deleteMany.mockResolvedValue({ count: 0 });
    prisma.judgeAssignment.createMany.mockResolvedValue({ count: 1 });
    prisma.notification.createMany.mockResolvedValue({ count: 1 });

    await expect(
      service.assignJudges(3, [11], 7, undefined, 99),
    ).resolves.toEqual({ message: "Judges assigned successfully." });

    expect(prisma.judgeAssignment.createMany).toHaveBeenCalledWith({
      data: [
        {
          judgeId: 11,
          roundId: 7,
          trackId: null,
          assignedById: 99,
        },
      ],
    });
  });

  it("allows a judge to also be assigned as a mentor", async () => {
    prisma.mentorAssignment.findFirst.mockResolvedValue(null);
    prisma.team.findUnique.mockResolvedValue({
      id: 20,
      eventId: 3,
      name: "Team Alpha",
    });
    prisma.mentorAssignment.create.mockResolvedValue({
      id: 5,
      mentorId: 11,
      teamId: 20,
    });
    prisma.notification.create.mockResolvedValue({ id: 8 });

    await expect(service.assignMentor(20, 11, 99)).resolves.toMatchObject({
      mentorId: 11,
      teamId: 20,
    });

    expect(prisma.mentorAssignment.create).toHaveBeenCalledWith({
      data: {
        teamId: 20,
        mentorId: 11,
        assignedById: 99,
      },
      include: {
        mentor: { select: { id: true, name: true, email: true } },
      },
    });
  });

  it("allows a judge to be bulk-assigned as mentor from the organizer UI", async () => {
    prisma.mentorAssignment.findFirst.mockResolvedValue(null);
    prisma.mentorAssignment.createMany.mockResolvedValue({ count: 2 });
    prisma.team.findMany.mockResolvedValue([
      { id: 20, eventId: 3, name: "Team Alpha" },
      { id: 21, eventId: 3, name: "Team Beta" },
    ]);
    prisma.notification.create.mockResolvedValue({ id: 8 });

    await expect(service.bulkAssignMentor(11, [20, 21], 99)).resolves.toEqual({
      count: 2,
    });

    expect(prisma.mentorAssignment.createMany).toHaveBeenCalledWith({
      data: [
        { mentorId: 11, teamId: 20, assignedById: 99 },
        { mentorId: 11, teamId: 21, assignedById: 99 },
      ],
      skipDuplicates: true,
    });
  });
});
