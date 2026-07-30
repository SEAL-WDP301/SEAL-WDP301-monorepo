import { EventEmitter2 } from "@nestjs/event-emitter";
import { TeamStatus } from "@prisma/client";
import { MailService } from "../../../core/mail/mail.service";
import { StorageService } from "../../../core/storage/storage.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { TeamStudentService } from "./team.student.service";

describe("TeamStudentService event capacity", () => {
  const transactionClient = {
    $queryRaw: jest.fn(),
    event: { findUnique: jest.fn() },
    team: { count: jest.fn(), create: jest.fn() },
    round: { findFirst: jest.fn() },
    teamMember: { create: jest.fn(), createMany: jest.fn() },
    studentRegistration: { upsert: jest.fn() },
  };
  const prisma = {
    event: { findUnique: jest.fn() },
    track: { findUnique: jest.fn() },
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    teamMember: { findMany: jest.fn() },
    $transaction: jest.fn(
      (callback: (tx: typeof transactionClient) => unknown) =>
        callback(transactionClient),
    ),
  };
  const eventEmitter = { emit: jest.fn() };
  const service = new TeamStudentService(
    prisma as unknown as PrismaService,
    {} as MailService,
    {} as StorageService,
    eventEmitter as unknown as EventEmitter2,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.event.findUnique.mockResolvedValue({
      id: 3,
      status: "active",
      registrationDeadline: null,
    });
    prisma.track.findUnique.mockResolvedValue({
      id: 7,
      eventId: 3,
      name: "AI",
      maxMembersPerTeam: 5,
    });
    prisma.user.findMany.mockResolvedValue([]);
    prisma.teamMember.findMany.mockResolvedValue([]);
    transactionClient.$queryRaw.mockResolvedValue([{ id: 3 }]);
  });

  it("rejects a new team when pending and approved teams fill the event", async () => {
    transactionClient.event.findUnique.mockResolvedValue({
      status: "active",
      registrationDeadline: null,
      maxTeams: 10,
    });
    transactionClient.team.count.mockResolvedValue(10);

    await expect(
      service.registerTeam(11, 3, {
        trackId: 7,
        teamName: "Last Team",
        memberEmails: [],
      }),
    ).rejects.toMatchObject({
      response: {
        errorCode: "EVENT_TEAM_CAPACITY_REACHED",
        maxTeams: 10,
        registeredTeams: 10,
      },
    });

    expect(transactionClient.team.count).toHaveBeenCalledWith({
      where: {
        eventId: 3,
        status: {
          in: [TeamStatus.pending, TeamStatus.approved],
        },
      },
    });
    expect(transactionClient.team.create).not.toHaveBeenCalled();
  });

  it("automatically approves a team while the event still has capacity", async () => {
    transactionClient.event.findUnique.mockResolvedValue({
      status: "active",
      registrationDeadline: null,
      maxTeams: 10,
    });
    transactionClient.team.count.mockResolvedValue(9);
    transactionClient.team.create.mockResolvedValue({
      id: 20,
      name: "Tenth Team",
    });
    transactionClient.round.findFirst.mockResolvedValue(null);
    transactionClient.teamMember.create.mockResolvedValue({});
    transactionClient.studentRegistration.upsert.mockResolvedValue({});

    await expect(
      service.registerTeam(11, 3, {
        trackId: 7,
        teamName: "Tenth Team",
        memberEmails: [],
      }),
    ).resolves.toMatchObject({ id: 20, name: "Tenth Team" });

    expect(transactionClient.team.create).toHaveBeenCalledWith({
      data: {
        name: "Tenth Team",
        eventId: 3,
        trackId: 7,
        leaderId: 11,
        status: TeamStatus.approved,
      },
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      "team.registered",
      expect.objectContaining({ eventId: 3, teamId: 20 }),
    );
  });

  it("does not apply a team limit when maxTeams is null", async () => {
    transactionClient.event.findUnique.mockResolvedValue({
      status: "active",
      registrationDeadline: null,
      maxTeams: null,
    });
    transactionClient.team.create.mockResolvedValue({
      id: 21,
      name: "Unlimited Team",
    });
    transactionClient.round.findFirst.mockResolvedValue(null);
    transactionClient.teamMember.create.mockResolvedValue({});
    transactionClient.studentRegistration.upsert.mockResolvedValue({});

    await service.registerTeam(11, 3, {
      trackId: 7,
      teamName: "Unlimited Team",
      memberEmails: [],
    });

    expect(transactionClient.team.count).not.toHaveBeenCalled();
    expect(transactionClient.team.create).toHaveBeenCalled();
  });
});
