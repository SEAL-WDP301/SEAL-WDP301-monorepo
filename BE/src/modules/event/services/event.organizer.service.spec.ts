import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  EventStatus,
  RoundStatus,
  Season,
  SubmissionType,
} from "@prisma/client";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { CreateEventDto } from "../dto/create-event.dto";
import { RoundAutomationSchedulerService } from "../../round/services/round-automation-scheduler.service";
import { TeamGithubService } from "../../team/services/team-github.service";
import { GithubWebhookService } from "../../github/services/github.webhook.service";
import { EventOrganizerService } from "./event.organizer.service";
import { TrackAssignmentService } from "./track-assignment.service";

describe("EventOrganizerService team member limits", () => {
  const prisma = {
    event: { create: jest.fn() },
  };
  const service = new EventOrganizerService(
    prisma as unknown as PrismaService,
    {} as TeamGithubService,
    {} as RoundAutomationSchedulerService,
    {} as TrackAssignmentService,
    { freezeEventRepos: jest.fn() } as unknown as GithubWebhookService,
  );

  const dto = {
    name: "SEAL Event",
    season: Season.Summer,
    year: 2026,
    status: EventStatus.draft,
    minMembersPerTeam: 2,
    maxMembersPerTeam: 5,
    tracks: [{ name: "Web" }],
    rounds: [
      {
        roundNumber: 1,
        name: "Proposal",
        submissionType: SubmissionType.file,
        isTrackSpecific: false,
      },
    ],
  } as CreateEventDto;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.event.create.mockResolvedValue({ id: 1 });
  });

  it("stores the event-level minimum and maximum", async () => {
    await service.createEvent(42, dto);

    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          minMembersPerTeam: 2,
          maxMembersPerTeam: 5,
          tracks: { create: [{ name: "Web" }] },
        }),
      }),
    );
  });

  it("rejects a minimum greater than the maximum", async () => {
    await expect(
      service.createEvent(42, {
        ...dto,
        minMembersPerTeam: 5,
        maxMembersPerTeam: 4,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  it("rejects event team limits outside 2 to 5 members", async () => {
    await expect(
      service.createEvent(42, {
        ...dto,
        minMembersPerTeam: 1,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "INVALID_TEAM_MEMBER_LIMITS",
      }),
    });

    await expect(
      service.createEvent(42, {
        ...dto,
        maxMembersPerTeam: 6,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "INVALID_TEAM_MEMBER_LIMITS",
      }),
    });

    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  it("allows ranked prizes to have equal amounts", async () => {
    await service.createEvent(42, {
      ...dto,
      prizes: [
        { name: "First", placement: 1, amount: 10_000_000 },
        { name: "Second", placement: 2, amount: 10_000_000 },
        { name: "Third", placement: 3, amount: 10_000_000 },
      ],
    });

    expect(prisma.event.create).toHaveBeenCalled();
  });

  it("rejects a third prize worth more than the second prize", async () => {
    await expect(
      service.createEvent(42, {
        ...dto,
        prizes: [
          { name: "Third", placement: 3, amount: 10_000_000 },
          { name: "Second", placement: 2, amount: 5_000_000 },
          { name: "First", placement: 1, amount: 12_500_000 },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: "INVALID_PRIZE_ORDER" }),
    });

    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  it("compares ranked prizes when the middle placement is missing", async () => {
    await expect(
      service.createEvent(42, {
        ...dto,
        prizes: [
          { name: "First", placement: 1, amount: 5_000_000 },
          { name: "Third", placement: 3, amount: 10_000_000 },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: "INVALID_PRIZE_ORDER" }),
    });

    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  it("allows dynamically ranked prizes beyond third place", async () => {
    await service.createEvent(42, {
      ...dto,
      prizes: [
        { name: "First", placement: 1, amount: 10_000_000 },
        { name: "Fourth", placement: 4, amount: 5_000_000 },
        { name: "Sixth", placement: 6, amount: 1_000_000 },
      ],
    });

    expect(prisma.event.create).toHaveBeenCalled();
  });

  it("validates the amount order for dynamic placements", async () => {
    await expect(
      service.createEvent(42, {
        ...dto,
        prizes: [
          { name: "Third", placement: 3, amount: 5_000_000 },
          { name: "Fourth", placement: 4, amount: 6_000_000 },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: "INVALID_PRIZE_ORDER" }),
    });

    expect(prisma.event.create).not.toHaveBeenCalled();
  });
});

describe("EventOrganizerService#assertRoundProblemsReady (private, via cast)", () => {
  const prisma = {
    event: { findUnique: jest.fn() },
    round: { findFirst: jest.fn(), findMany: jest.fn() },
    roundTrackProblem: { findMany: jest.fn(), findUnique: jest.fn() },
    track: { findMany: jest.fn() },
  };
  const service = new EventOrganizerService(
    prisma as unknown as PrismaService,
    {} as TeamGithubService,
    {} as RoundAutomationSchedulerService,
    {} as TrackAssignmentService,
    { freezeEventRepos: jest.fn() } as unknown as GithubWebhookService,
  );

  const round = {
    id: 10,
    name: "Qualifier",
    isTrackSpecific: true,
    problemFileUrl: null as string | null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.event.findUnique.mockResolvedValue({
      deferredTrackAssignment: true,
    });
    prisma.round.findFirst.mockResolvedValue({ roundNumber: 2 });
    prisma.round.findMany.mockResolvedValue([]);
    prisma.roundTrackProblem.findUnique.mockResolvedValue(null);
  });

  it("ignores event tracks not scoped to this round (Flow B, deferred)", async () => {
    prisma.roundTrackProblem.findMany
      .mockResolvedValueOnce([{ track: { id: 1, name: "AI" } }]) // round scope
      .mockResolvedValueOnce([
        { trackId: 1, problemFileUrl: "https://x/ai.pdf" },
      ]); // uploaded files

    await expect(
      (service as any).assertRoundProblemsReady(1, round, true),
    ).resolves.toBeUndefined();

    // The old behavior queried prisma.track.findMany(all event tracks) — the
    // fix must not need it for a deferred track-specific round.
    expect(prisma.track.findMany).not.toHaveBeenCalled();
  });

  it("blocks opening when a track scoped to this round has no problem file", async () => {
    prisma.roundTrackProblem.findMany
      .mockResolvedValueOnce([{ track: { id: 1, name: "AI" } }])
      .mockResolvedValueOnce([]); // no file uploaded yet

    await expect(
      (service as any).assertRoundProblemsReady(1, round, true),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows opening Flow B round when đề is inherited from an earlier round", async () => {
    prisma.roundTrackProblem.findMany
      .mockResolvedValueOnce([{ track: { id: 1, name: "AI" } }])
      .mockResolvedValueOnce([]); // no local file on R2
    prisma.round.findMany.mockResolvedValueOnce([{ id: 9, roundNumber: 1 }]);
    prisma.roundTrackProblem.findUnique.mockResolvedValueOnce({
      problemFileUrl: "https://x/ai.pdf",
    });

    await expect(
      (service as any).assertRoundProblemsReady(1, round, true),
    ).resolves.toBeUndefined();
  });

  it("blocks opening a track-specific round with zero tracks scoped to it", async () => {
    prisma.roundTrackProblem.findMany.mockResolvedValueOnce([]); // nothing scoped

    await expect(
      (service as any).assertRoundProblemsReady(1, round, true),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.roundTrackProblem.findMany).toHaveBeenCalledTimes(1);
  });

  it("track-specific round (Flow A) uses round-scoped tracks only", async () => {
    prisma.roundTrackProblem.findMany
      .mockResolvedValueOnce([{ track: { id: 1, name: "AI" } }])
      .mockResolvedValueOnce([
        { trackId: 1, problemFileUrl: "https://x/ai.pdf" },
      ]);

    await expect(
      (service as any).assertRoundProblemsReady(1, round, false),
    ).resolves.toBeUndefined();

    expect(prisma.track.findMany).not.toHaveBeenCalled();
  });

  it("blocks Flow A track-specific round when scoped track has no problem file", async () => {
    prisma.roundTrackProblem.findMany
      .mockResolvedValueOnce([
        { track: { id: 1, name: "AI" } },
        { track: { id: 2, name: "Web" } },
      ])
      .mockResolvedValueOnce([
        { trackId: 1, problemFileUrl: "https://x/ai.pdf" },
      ]);

    await expect(
      (service as any).assertRoundProblemsReady(1, round, false),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("shared (non-track-specific) round just needs its own problem file", async () => {
    const shared = { ...round, isTrackSpecific: false };

    await expect(
      (service as any).assertRoundProblemsReady(1, shared, false),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      (service as any).assertRoundProblemsReady(
        1,
        { ...shared, problemFileUrl: "https://x/shared.pdf" },
        false,
      ),
    ).resolves.toBeUndefined();

    expect(prisma.roundTrackProblem.findMany).not.toHaveBeenCalled();
  });
});

describe("EventOrganizerService.removeTrackFromRound", () => {
  const prisma = {
    round: { findFirst: jest.fn() },
    roundTrackProblem: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    team: { count: jest.fn().mockResolvedValue(0) },
    track: { delete: jest.fn().mockResolvedValue({}) },
  };
  const service = new EventOrganizerService(
    prisma as unknown as PrismaService,
    {} as TeamGithubService,
    {} as RoundAutomationSchedulerService,
    {} as TrackAssignmentService,
    { freezeEventRepos: jest.fn() } as unknown as GithubWebhookService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes the RoundTrackProblem row when the round is Not Started", async () => {
    prisma.round.findFirst.mockResolvedValue({
      id: 10,
      eventId: 1,
      status: RoundStatus.not_started,
    });
    prisma.roundTrackProblem.findUnique.mockResolvedValue({
      roundId: 10,
      trackId: 1,
    });
    prisma.roundTrackProblem.delete.mockResolvedValue({});

    await service.removeTrackFromRound(1, 10, 1);

    expect(prisma.roundTrackProblem.delete).toHaveBeenCalledWith({
      where: { roundId_trackId: { roundId: 10, trackId: 1 } },
    });
  });

  it("rejects when the round is not Not Started", async () => {
    prisma.round.findFirst.mockResolvedValue({
      id: 10,
      eventId: 1,
      status: RoundStatus.open,
    });

    await expect(service.removeTrackFromRound(1, 10, 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.roundTrackProblem.delete).not.toHaveBeenCalled();
  });

  it("404s when the track isn't scoped to this round", async () => {
    prisma.round.findFirst.mockResolvedValue({
      id: 10,
      eventId: 1,
      status: RoundStatus.not_started,
    });
    prisma.roundTrackProblem.findUnique.mockResolvedValue(null);

    await expect(service.removeTrackFromRound(1, 10, 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.roundTrackProblem.delete).not.toHaveBeenCalled();
  });

  it("404s when the round doesn't belong to the event", async () => {
    prisma.round.findFirst.mockResolvedValue(null);

    await expect(service.removeTrackFromRound(1, 10, 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
