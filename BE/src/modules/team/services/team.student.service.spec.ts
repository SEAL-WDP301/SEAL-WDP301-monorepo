import { EventEmitter2 } from "@nestjs/event-emitter";
import { TeamStatus } from "@prisma/client";
import { MailService } from "../../../core/mail/mail.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { TeamStudentService } from "./team.student.service";
import { TeamRegistrationService } from "./team-registration.service";
import { TeamInvitationService } from "./team-invitation.service";
import { TeamWorkspaceService } from "./team-workspace.service";
import { TrackAssignmentService } from "../../event/services/track-assignment.service";

describe("TeamStudentService event capacity", () => {
  const transactionClient = {
    $queryRaw: jest.fn(),
    event: { findUnique: jest.fn() },
    team: {
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    round: { findFirst: jest.fn() },
    teamMember: {
      create: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    teamInvitation: {
      createMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    studentRegistration: { upsert: jest.fn() },
    notification: { createMany: jest.fn() },
  };
  const prisma = {
    event: { findUnique: jest.fn() },
    track: { findUnique: jest.fn(), count: jest.fn() },
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    teamMember: { findMany: jest.fn(), findFirst: jest.fn() },
    teamInvitation: { findUnique: jest.fn(), findMany: jest.fn() },
    studentRegistration: { findUnique: jest.fn() },
    $transaction: jest.fn(
      (callback: (tx: typeof transactionClient) => unknown) =>
        callback(transactionClient),
    ),
  };
  const mailService = { sendTeamInvitationEmail: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const configService = {
    get: jest.fn().mockReturnValue("http://localhost:3001"),
  } as never;
  const redisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    incr: jest.fn(),
  } as never;
  const trackAssignmentService = {} as TrackAssignmentService;

  const invitationService = new TeamInvitationService(
    prisma as unknown as PrismaService,
    mailService as unknown as MailService,
    configService,
    redisService,
  );

  const registrationService = new TeamRegistrationService(
    prisma as unknown as PrismaService,
    mailService as unknown as MailService,
    eventEmitter as unknown as EventEmitter2,
    invitationService,
  );

  const workspaceService = new TeamWorkspaceService(
    prisma as unknown as PrismaService,
    trackAssignmentService,
  );

  const service = new TeamStudentService(
    prisma as unknown as PrismaService,
    registrationService,
    invitationService,
    workspaceService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.event.findUnique.mockResolvedValue({
      id: 3,
      status: "active",
      registrationDeadline: null,
      minMembersPerTeam: 1,
      maxMembersPerTeam: 5,
      deferredTrackAssignment: false,
    });
    prisma.track.count.mockResolvedValue(1);
    prisma.track.findUnique.mockResolvedValue({
      id: 7,
      eventId: 3,
      name: "AI",
    });
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue({
      id: 11,
      email: "leader@test.dev",
      name: "Leader",
    });
    prisma.teamInvitation.findMany.mockResolvedValue([]);
    prisma.teamMember.findMany.mockResolvedValue([]);
    transactionClient.$queryRaw.mockResolvedValue([{ id: 3 }]);
    transactionClient.teamInvitation.findFirst.mockResolvedValue(null);
  });

  it("rejects a team outside the event member limits", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 3,
      status: "active",
      registrationDeadline: null,
      minMembersPerTeam: 2,
      maxMembersPerTeam: 3,
      deferredTrackAssignment: false,
    });

    await expect(
      service.registerTeam(11, 3, {
        trackId: 7,
        teamName: "Solo Team",
        memberEmails: [],
      }),
    ).rejects.toMatchObject({
      response: {
        errorCode: "TEAM_MEMBER_LIMIT_VIOLATION",
        minMembersPerTeam: 2,
        maxMembersPerTeam: 3,
      },
    });

    await expect(
      service.registerTeam(11, 3, {
        trackId: 7,
        teamName: "Large Team",
        memberEmails: ["a@test.dev", "b@test.dev", "c@test.dev"],
      }),
    ).rejects.toMatchObject({
      response: {
        errorCode: "TEAM_MEMBER_LIMIT_VIOLATION",
      },
    });
  });

  it("does not expose an orphaned team registration as an individual registration", async () => {
    prisma.studentRegistration.findUnique.mockResolvedValue({
      id: 181,
      userId: 11,
      eventId: 3,
      trackId: 7,
      hasTeam: true,
    });
    prisma.teamMember.findFirst.mockResolvedValue(null);

    await expect(service.getRegistrationStatus(3, 11)).resolves.toEqual({
      individualRegistration: null,
      teamInfo: null,
    });
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

  it("auto-approves only when the leader alone already meets minMembersPerTeam", async () => {
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

    // Default fixture minMembersPerTeam=1 → leader alone is enough.
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

  it("keeps a newly registered team pending until invited members accept", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 3,
      status: "active",
      registrationDeadline: null,
      minMembersPerTeam: 3,
      maxMembersPerTeam: 5,
      deferredTrackAssignment: false,
    });
    transactionClient.event.findUnique.mockResolvedValue({
      status: "active",
      registrationDeadline: null,
      maxTeams: null,
    });
    transactionClient.team.create.mockResolvedValue({
      id: 24,
      name: "Waiting Team",
    });
    transactionClient.round.findFirst.mockResolvedValue(null);
    transactionClient.teamMember.create.mockResolvedValue({});
    transactionClient.teamInvitation.createMany.mockResolvedValue({ count: 2 });
    transactionClient.studentRegistration.upsert.mockResolvedValue({});

    await expect(
      service.registerTeam(11, 3, {
        trackId: 7,
        teamName: "Waiting Team",
        memberEmails: ["a@test.dev", "b@test.dev"],
      }),
    ).resolves.toMatchObject({ id: 24 });

    expect(transactionClient.team.create).toHaveBeenCalledWith({
      data: {
        name: "Waiting Team",
        eventId: 3,
        trackId: 7,
        leaderId: 11,
        status: TeamStatus.pending,
      },
    });
  });

  it("clears the previous rejection review when a student registers again", async () => {
    transactionClient.event.findUnique.mockResolvedValue({
      status: "active",
      registrationDeadline: null,
      maxTeams: 10,
    });
    transactionClient.team.count.mockResolvedValue(0);
    transactionClient.team.create.mockResolvedValue({
      id: 23,
      name: "Second Chance Team",
    });
    transactionClient.round.findFirst.mockResolvedValue(null);
    transactionClient.teamMember.create.mockResolvedValue({});
    transactionClient.studentRegistration.upsert.mockResolvedValue({});

    await service.registerTeam(11, 3, {
      trackId: 7,
      teamName: "Second Chance Team",
      memberEmails: [],
    });

    expect(transactionClient.studentRegistration.upsert).toHaveBeenCalledWith({
      where: { userId_eventId: { userId: 11, eventId: 3 } },
      update: expect.objectContaining({
        trackId: 7,
        hasTeam: true,
        reviewedById: null,
        reviewedAt: null,
        note: null,
      }),
      create: {
        userId: 11,
        eventId: 3,
        trackId: 7,
        hasTeam: true,
      },
    });
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

  it("rejects duplicate invite emails case-insensitively", async () => {
    await expect(
      service.registerTeam(11, 3, {
        trackId: 7,
        teamName: "Duplicate Team",
        memberEmails: ["Member@Test.dev", " member@test.dev "],
      }),
    ).rejects.toMatchObject({
      response: {
        errorCode: "DUPLICATE_TEAM_MEMBER_EMAIL",
      },
    });
  });

  it("creates invitations and sends email for users outside the system", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 3,
      name: "SEAL 2026",
      status: "active",
      registrationDeadline: null,
      minMembersPerTeam: 2,
      maxMembersPerTeam: 5,
      deferredTrackAssignment: false,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 11,
      email: "leader@test.dev",
      name: "Leader",
    });
    transactionClient.event.findUnique.mockResolvedValue({
      status: "active",
      registrationDeadline: null,
      maxTeams: null,
    });
    transactionClient.team.create.mockResolvedValue({
      id: 22,
      name: "External Team",
    });
    transactionClient.round.findFirst.mockResolvedValue(null);
    transactionClient.teamMember.create.mockResolvedValue({});
    transactionClient.teamInvitation.createMany.mockResolvedValue({ count: 1 });
    transactionClient.studentRegistration.upsert.mockResolvedValue({});
    mailService.sendTeamInvitationEmail.mockResolvedValue({});

    await expect(
      service.registerTeam(11, 3, {
        trackId: 7,
        teamName: "External Team",
        memberEmails: [" NewUser@Test.dev "],
      }),
    ).resolves.toMatchObject({ id: 22 });

    expect(transactionClient.team.create).toHaveBeenCalledWith({
      data: {
        name: "External Team",
        eventId: 3,
        trackId: 7,
        leaderId: 11,
        // minMembersPerTeam=2 and only the leader is accepted yet
        status: TeamStatus.pending,
      },
    });
    expect(transactionClient.teamInvitation.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          teamId: 22,
          email: "newuser@test.dev",
          invitedById: 11,
          status: "pending",
        }),
      ],
    });
    expect(mailService.sendTeamInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "newuser@test.dev",
        teamName: "External Team",
      }),
    );
  });

  it("accepts a token invitation with the invited verified profile", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 12,
      email: "member@test.dev",
      name: "Member",
      isActive: true,
      role: "student",
      studentProfile: { id: 30 },
    });
    prisma.teamInvitation.findUnique.mockResolvedValue({ id: 50 });
    transactionClient.teamInvitation.findUnique.mockResolvedValue({
      id: 50,
      teamId: 22,
      email: "member@test.dev",
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000),
      team: {
        id: 22,
        name: "External Team",
        leaderId: 11,
        eventId: 3,
        trackId: 7,
        event: {
          id: 3,
          registrationDeadline: null,
          minMembersPerTeam: 2,
          maxMembersPerTeam: 4,
        },
        members: [{ userId: 11, status: "accepted" }],
      },
    });
    transactionClient.teamMember.count.mockResolvedValue(1);
    transactionClient.teamMember.findFirst.mockResolvedValue(null);
    transactionClient.teamMember.upsert.mockResolvedValue({
      id: 60,
      teamId: 22,
      userId: 12,
      status: "accepted",
    });
    transactionClient.teamInvitation.update.mockResolvedValue({});
    transactionClient.teamInvitation.updateMany.mockResolvedValue({ count: 0 });
    transactionClient.studentRegistration.upsert.mockResolvedValue({});
    transactionClient.notification.createMany.mockResolvedValue({ count: 2 });
    transactionClient.team.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.respondToInvitationToken(12, "raw-token", true),
    ).resolves.toMatchObject({ teamId: 22, userId: 12, status: "accepted" });

    expect(transactionClient.teamMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamId_userId: { teamId: 22, userId: 12 } },
      }),
    );
    expect(transactionClient.teamInvitation.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { status: "accepted", acceptedById: 12 },
    });
    expect(transactionClient.team.updateMany).toHaveBeenCalledWith({
      where: {
        id: 22,
        status: TeamStatus.pending,
      },
      data: { status: TeamStatus.approved },
    });
  });
});
