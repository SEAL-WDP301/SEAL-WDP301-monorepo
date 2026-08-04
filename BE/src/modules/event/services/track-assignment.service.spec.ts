import { TrackAssignmentService } from "./track-assignment.service";

describe("TrackAssignmentService even distribution", () => {
  const prisma = {
    event: { findUnique: jest.fn() },
    round: { count: jest.fn() },
    roundTrackProblem: { findMany: jest.fn() },
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
  });

  it("blocks force-reassign after a round has started", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 1,
      deferredTrackAssignment: true,
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

  it("no-ops when every team already has a track", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 1,
      deferredTrackAssignment: true,
      tracks: [{ id: 1, name: "Only" }],
    });
    prisma.team.findMany.mockResolvedValue([]);
    prisma.team.count.mockResolvedValue(3);

    const result = await service.assignDeferredTracks(1);
    expect(result.assignedCount).toBe(0);
    expect(result.skippedAlreadyAssigned).toBe(3);
  });
});
