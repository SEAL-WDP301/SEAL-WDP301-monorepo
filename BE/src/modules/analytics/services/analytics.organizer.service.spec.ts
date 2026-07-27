import { EventStatus, Season, TeamStatus } from "@prisma/client";
import { AnalyticsOrganizerRepository } from "../repositories/analytics.organizer.repository";
import { AnalyticsOrganizerService } from "./analytics.organizer.service";
import { OrganizerEventAccessService } from "./organizer-event-access.service";

describe("AnalyticsOrganizerService", () => {
  const repository = {
    findScopedEventIds: jest.fn(),
    findFilterOptions: jest.fn(),
    findEventsForMonthlyChart: jest.fn(),
    findEventStatuses: jest.fn(),
    getConversionCounts: jest.fn(),
    getParticipantsByEvent: jest.fn(),
  };
  const eventAccess = { ensureEventAccess: jest.fn() };
  const service = new AnalyticsOrganizerService(
    repository as unknown as AnalyticsOrganizerRepository,
    eventAccess as unknown as OrganizerEventAccessService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findScopedEventIds.mockResolvedValue([1]);
  });

  it("builds filter values only from accessible events", async () => {
    repository.findFilterOptions.mockResolvedValue([
      {
        id: 1,
        name: "Spring",
        season: Season.Spring,
        year: 2026,
        status: EventStatus.active,
      },
      {
        id: 2,
        name: "Fall",
        season: Season.Fall,
        year: 2025,
        status: EventStatus.closed,
      },
    ]);
    const result = await service.getFilterOptions(42);
    expect(result.seasons).toEqual([Season.Spring, Season.Fall]);
    expect(result.years).toEqual([2026, 2025]);
  });

  it("always returns all twelve months", async () => {
    repository.findEventsForMonthlyChart.mockResolvedValue([
      {
        createdAt: new Date("2026-01-10T00:00:00.000Z"),
        startDate: new Date("2026-02-01T00:00:00.000Z"),
        endDate: new Date("2026-03-01T00:00:00.000Z"),
        status: EventStatus.closed,
      },
    ]);
    const result = await service.getEventsByMonth(42, { year: 2026 });
    expect(result.data).toHaveLength(12);
    expect(result.data[0].created).toBe(1);
    expect(result.data[1].starting).toBe(1);
    expect(result.data[2].completed).toBe(1);
    expect(result.data[3]).toEqual({
      month: 4,
      created: 0,
      starting: 0,
      completed: 0,
    });
  });

  it("returns all status categories without NaN when there are no events", async () => {
    repository.findScopedEventIds.mockResolvedValue([]);
    repository.findEventStatuses.mockResolvedValue([]);
    const result = await service.getEventStatus(42, {});
    expect(result.total).toBe(0);
    expect(result.data).toHaveLength(6);
    expect(result.data.every(({ percentage }) => percentage === 0)).toBe(true);
  });

  it("keeps each funnel monotonically non-increasing", async () => {
    repository.getConversionCounts.mockResolvedValue({
      registered: 10,
      approved: 8,
      joined: 12,
      eligibleTeams: 5,
      submittedTeams: 9,
      evaluatedTeams: 8,
    });
    const result = await service.getParticipationConversion(42, {});
    expect(result.registrationFunnel.map(({ count }) => count)).toEqual([
      10, 8, 8,
    ]);
    expect(result.submissionFunnel.map(({ count }) => count)).toEqual([
      5, 5, 5,
    ]);
  });

  it("handles missing and zero event capacity", async () => {
    repository.getParticipantsByEvent.mockResolvedValue([
      {
        id: 1,
        name: "No capacity",
        registrations: [],
        tracks: [{ maxTeams: null, maxMembersPerTeam: 4 }],
        teams: [
          {
            id: 2,
            status: TeamStatus.approved,
            members: [{ userId: 7 }],
            submissions: [],
          },
        ],
      },
    ]);
    const result = await service.getParticipantsByEvent(42, {});
    expect(result.data[0].capacity).toBeNull();
    expect(result.data[0].capacityRate).toBeNull();
  });

  it("checks explicit event access before querying scoped data", async () => {
    repository.findEventStatuses.mockResolvedValue([]);
    await service.getEventStatus(42, { eventId: 9 });
    expect(eventAccess.ensureEventAccess).toHaveBeenCalledWith(42, 9);
  });
});
