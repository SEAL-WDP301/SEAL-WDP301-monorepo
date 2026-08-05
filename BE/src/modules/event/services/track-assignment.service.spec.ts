import { TrackAssignmentService } from "./track-assignment.service";

describe("TrackAssignmentService even distribution", () => {
  const prisma = {
    event: { findUnique: jest.fn() },
    round: { count: jest.fn() },
    roundTrackProblem: { findMany: jest.fn() },
    teamRound: { findMany: jest.fn() },
    team: { findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
    teamMember: { findMany: jest.fn() },
    studentRegistration: { updateMany: jest.fn() },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) =>
      Promise.all(ops),
    ),
  };

  const service = new TrackAssignmentService(prisma as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.round.count.mockResolvedValue(0);
    prisma.team.update.mockImplementation(({ where, data }: any) =>
      Promise.resolve({ id: where.id, ...data }),
    );
    prisma.studentRegistration.updateMany.mockResolvedValue({ count: 0 });
    prisma.teamMember.findMany.mockResolvedValue([]);
    prisma.team.count.mockResolvedValue(0);
    prisma.teamRound.findMany.mockResolvedValue([]);
  });

  it("blocks force-reassign after a round has started", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 1,
      deferredTrackAssignment: true,
      maxTeams: null,
      tracks: [{ id: 1, name: "Only" }],
    });
    prisma.round.count.mockResolvedValue(1);

    await expect(
      service.assignDeferredTracks(1, { forceReassign: true }),
    ).rejects.toThrow(
      "Cannot force-reassign tracks after a round has started.",
    );
  });

  it("assigns 10 teams across 5 round-scoped tracks with 2 each", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 1,
      deferredTrackAssignment: true,
      maxTeams: null,
      tracks: [1, 2, 3, 4, 5, 6].map((id) => ({ id, name: `T${id}` })),
    });
    prisma.roundTrackProblem.findMany.mockResolvedValue(
      [1, 2, 3, 4, 5].map((id) => ({ track: { id, name: `T${id}` } })),
    );
    prisma.team.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `Team ${i + 1}`,
        trackId: null,
      })),
    );

    const result = await service.assignDeferredTracks(1, { roundId: 99 });
    expect(result.assignedCount).toBe(10);
    expect(result.trackCounts.every((c) => c.teamCount === 2)).toBe(true);
    expect(new Set(result.assignments.map((a) => a.trackId)).size).toBe(5);
    expect(prisma.roundTrackProblem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { roundId: 99 } }),
    );
  });

  it("assigns 10 teams across 5 catalog tracks when no roundId", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 1,
      deferredTrackAssignment: true,
      maxTeams: null,
      tracks: [1, 2, 3, 4, 5].map((id) => ({ id, name: `T${id}` })),
    });
    prisma.team.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `Team ${i + 1}`,
        trackId: null,
      })),
    );

    const result = await service.assignDeferredTracks(1);
    expect(result.assignedCount).toBe(10);
    expect(result.trackCounts.every((c) => c.teamCount === 2)).toBe(true);
    expect(new Set(result.assignments.map((a) => a.trackId)).size).toBe(5);
  });

  it("no-ops when every team already has a track (manual reveal)", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 1,
      deferredTrackAssignment: true,
      maxTeams: null,
      tracks: [{ id: 1, name: "Only" }],
    });
    prisma.team.findMany.mockResolvedValue([]);
    prisma.team.count.mockResolvedValue(3);

    const result = await service.assignDeferredTracks(1);
    expect(result.assignedCount).toBe(0);
    expect(result.skippedAlreadyAssigned).toBe(3);
  });

  it("does not reassign teams that already have a track when opening a later round", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 1,
      deferredTrackAssignment: true,
      maxTeams: null,
      tracks: [
        { id: 1, name: "Track A" },
        { id: 2, name: "Track B" },
      ],
    });
    prisma.roundTrackProblem.findMany.mockResolvedValue([
      { track: { id: 2, name: "Track B" } },
    ]);
    prisma.team.findMany.mockResolvedValue([]);
    prisma.team.count.mockResolvedValue(2);

    const result = await service.assignDeferredTracks(1, { roundId: 50 });

    expect(result.assignedCount).toBe(0);
    expect(result.skippedAlreadyAssigned).toBe(2);
    expect(prisma.team.update).not.toHaveBeenCalled();
  });

  it("assigns 7 teams across 3 round-scoped tracks (3+2+2 or 3+3+1)", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 1,
      deferredTrackAssignment: true,
      maxTeams: null,
      tracks: [1, 2, 3].map((id) => ({ id, name: `T${id}` })),
    });
    prisma.roundTrackProblem.findMany.mockResolvedValue(
      [1, 2, 3].map((id) => ({ track: { id, name: `T${id}` } })),
    );
    prisma.team.findMany.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({
        id: i + 1,
        name: `Team ${i + 1}`,
        trackId: null,
      })),
    );

    const result = await service.assignDeferredTracks(1, { roundId: 99 });
    expect(result.assignedCount).toBe(7);
    const counts = result.trackCounts.map((c) => c.teamCount).sort();
    expect(counts).toEqual([2, 2, 3]);
  });

  it("legacy reassignForRoundOpen still reshuffles when explicitly requested", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 1,
      deferredTrackAssignment: true,
      maxTeams: null,
      tracks: [
        { id: 1, name: "R1-A" },
        { id: 2, name: "R2-only" },
      ],
    });
    prisma.roundTrackProblem.findMany.mockResolvedValue([
      { track: { id: 2, name: "R2-only" } },
    ]);
    prisma.teamRound.findMany.mockResolvedValue([
      { teamId: 10 },
      { teamId: 11 },
    ]);
    prisma.team.findMany.mockResolvedValue([
      { id: 10, name: "Team 10", trackId: 1 },
      { id: 11, name: "Team 11", trackId: 1 },
    ]);

    const result = await service.assignDeferredTracks(1, {
      roundId: 50,
      reassignForRoundOpen: true,
    });

    expect(result.assignedCount).toBe(2);
    expect(result.assignments.every((a) => a.trackId === 2)).toBe(true);
  });

  it("blocks ceremony team lottery when teams already have tracks", async () => {
    prisma.team.count.mockResolvedValue(2);

    await expect(
      service.assertCeremonyTeamLotteryNotYetRun(1),
    ).rejects.toThrow("Phase 2 đã chạy");
  });
});
