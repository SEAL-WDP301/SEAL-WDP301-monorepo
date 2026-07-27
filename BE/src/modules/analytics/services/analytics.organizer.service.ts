import { Injectable } from "@nestjs/common";
import { EventStatus, SubmissionStatus, TeamStatus } from "@prisma/client";
import { EventsByMonthQueryDto } from "../dto/events-by-month-query.dto";
import { OrganizerDashboardQueryDto } from "../dto/organizer-dashboard-query.dto";
import { ParticipantsByEventQueryDto } from "../dto/participants-by-event-query.dto";
import { RecentRegistrationsQueryDto } from "../dto/recent-registrations-query.dto";
import { RegistrationTrendQueryDto } from "../dto/registration-trend-query.dto";
import { SubmissionsDashboardQueryDto } from "../dto/submissions-dashboard-query.dto";
import { UpcomingDeadlinesQueryDto } from "../dto/upcoming-deadlines-query.dto";
import { DashboardOverview } from "../interfaces/dashboard-overview.interface";
import { AnalyticsOrganizerRepository } from "../repositories/analytics.organizer.repository";
import { OrganizerEventAccessService } from "./organizer-event-access.service";
import {
  periodKey,
  resolveDateRange,
  resolveGroupBy,
} from "../utils/dashboard-date-range.util";
import { fillMissingPeriods } from "../utils/dashboard-grouping.util";
import {
  calculateChange,
  calculatePercentage,
} from "../utils/dashboard-percentage.util";

@Injectable()
export class AnalyticsOrganizerService {
  constructor(
    private readonly repository: AnalyticsOrganizerRepository,
    private readonly eventAccess: OrganizerEventAccessService,
  ) {}

  async getFilterOptions(organizerId: number) {
    const events = await this.repository.findFilterOptions(organizerId);
    return {
      events,
      seasons: [...new Set(events.map(({ season }) => season))],
      years: [...new Set(events.map(({ year }) => year))].sort((a, b) => b - a),
    };
  }

  async getOverview(
    organizerId: number,
    query: OrganizerDashboardQueryDto,
  ): Promise<DashboardOverview> {
    const eventIds = await this.getScopedEventIds(organizerId, query);
    const range = resolveDateRange(query);
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86_400_000);

    if (!eventIds.length) return this.emptyOverview();

    const [
      totalEvents,
      previousEvents,
      activeEvents,
      registrations,
      previousRegistrations,
      participants,
      previousParticipants,
      submissions,
      previousSubmissions,
      submittedLast24Hours,
      eligibleTeams,
      submittedTeams,
      submissionRows,
    ] = await Promise.all([
      this.repository.countEvents(eventIds, range.from, range.to),
      this.repository.countEvents(
        eventIds,
        range.previousFrom,
        range.previousTo,
      ),
      this.repository.getActiveEventSummary(eventIds, now),
      this.repository.countRegistrations(eventIds, range.from, range.to),
      this.repository.countRegistrations(
        eventIds,
        range.previousFrom,
        range.previousTo,
      ),
      this.repository.countApprovedParticipants(eventIds, range.from, range.to),
      this.repository.countApprovedParticipants(
        eventIds,
        range.previousFrom,
        range.previousTo,
      ),
      this.repository.countSubmissions(eventIds, range.from, range.to),
      this.repository.countSubmissions(
        eventIds,
        range.previousFrom,
        range.previousTo,
      ),
      this.repository.countSubmissions(eventIds, dayAgo, now),
      this.repository.countEligibleTeams(eventIds),
      this.repository.countSubmittedTeams(eventIds),
      this.repository.findSubmissions(eventIds, range.from, range.to),
    ]);

    return {
      totalEvents: {
        value: totalEvents,
        ...calculateChange(totalEvents, previousEvents),
        newEvents: totalEvents,
      },
      activeEvents,
      totalRegistrations: {
        value: registrations,
        ...calculateChange(registrations, previousRegistrations),
        pending: Math.max(0, registrations - participants),
      },
      totalParticipants: {
        value: participants,
        ...calculateChange(participants, previousParticipants),
        approvalRate: calculatePercentage(participants, registrations),
      },
      totalSubmissions: {
        value: submissions,
        ...calculateChange(submissions, previousSubmissions),
        last24Hours: submittedLast24Hours,
        pendingEvaluation: submissionRows.filter(
          ({ scores }) => scores.length === 0,
        ).length,
        submissionRate: calculatePercentage(submittedTeams, eligibleTeams),
      },
    };
  }

  async getEventsByMonth(organizerId: number, query: EventsByMonthQueryDto) {
    const year = query.year ?? new Date().getUTCFullYear();
    const eventIds = await this.getScopedEventIds(organizerId, query);
    const rows = await this.repository.findEventsForMonthlyChart(
      eventIds,
      year,
    );
    const data = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      created: 0,
      starting: 0,
      completed: 0,
    }));
    for (const row of rows) {
      if (row.createdAt.getUTCFullYear() === year)
        data[row.createdAt.getUTCMonth()].created++;
      if (row.startDate?.getUTCFullYear() === year)
        data[row.startDate.getUTCMonth()].starting++;
      if (
        row.status === EventStatus.closed &&
        row.endDate?.getUTCFullYear() === year
      )
        data[row.endDate.getUTCMonth()].completed++;
    }
    return { year, data };
  }

  async getEventStatus(organizerId: number, query: OrganizerDashboardQueryDto) {
    const eventIds = await this.getScopedEventIds(organizerId, query);
    const events = await this.repository.findEventStatuses(eventIds);
    const now = new Date();
    const statuses = [
      "DRAFT",
      "REGISTRATION_OPEN",
      "UPCOMING",
      "ONGOING",
      "COMPLETED",
      "CANCELLED",
    ] as const;
    const labels: Record<(typeof statuses)[number], string> = {
      DRAFT: "Draft",
      REGISTRATION_OPEN: "Registration Open",
      UPCOMING: "Upcoming",
      ONGOING: "Ongoing",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
    };
    const counts = new Map(statuses.map((status) => [status, 0]));
    for (const event of events) {
      let status: (typeof statuses)[number];
      if (event.status === EventStatus.draft) status = "DRAFT";
      else if (event.status === EventStatus.closed) status = "COMPLETED";
      else if (event.startDate && event.startDate > now) {
        status =
          event.status === EventStatus.active
            ? "REGISTRATION_OPEN"
            : "UPCOMING";
      } else status = "ONGOING";
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return {
      total: events.length,
      data: statuses.map((status) => ({
        status,
        label: labels[status],
        count: counts.get(status) ?? 0,
        percentage: calculatePercentage(counts.get(status) ?? 0, events.length),
      })),
    };
  }

  async getRegistrationTrend(
    organizerId: number,
    query: RegistrationTrendQueryDto,
  ) {
    const eventIds = await this.getScopedEventIds(organizerId, query);
    const range = resolveDateRange(query);
    const groupBy = resolveGroupBy(range, query.groupBy);
    const rows = await this.repository.findRegistrations(
      eventIds,
      range.from,
      range.to,
    );
    const grouped = new Map<
      string,
      { registrations: number; approvedParticipants: Set<number> }
    >();
    for (const row of rows) {
      const key = periodKey(row.createdAt, groupBy);
      if (!grouped.has(key))
        grouped.set(key, { registrations: 0, approvedParticipants: new Set() });
      const point = grouped.get(key)!;
      point.registrations++;
      if (row.user.teamMemberships.length)
        point.approvedParticipants.add(row.userId);
    }
    const data = fillMissingPeriods(
      range,
      groupBy,
      [...grouped].map(([period, point]) => ({
        period,
        registrations: point.registrations,
        approvedParticipants: point.approvedParticipants.size,
      })),
      { registrations: 0, approvedParticipants: 0 },
    );
    return { groupBy, data };
  }

  async getParticipationConversion(
    organizerId: number,
    query: OrganizerDashboardQueryDto,
  ) {
    const eventIds = await this.getScopedEventIds(organizerId, query);
    const counts = await this.repository.getConversionCounts(eventIds);
    const joined = Math.min(counts.joined, counts.approved);
    const submitted = Math.min(counts.submittedTeams, counts.eligibleTeams);
    const evaluated = Math.min(counts.evaluatedTeams, submitted);
    const registrationFunnel = this.buildFunnel([
      ["REGISTERED_USERS", "Registered Users", counts.registered],
      ["APPROVED_USERS", "Approved Users", counts.approved],
      ["JOINED_TEAM_USERS", "Users Joined Team", joined],
    ]);
    const submissionFunnel = this.buildFunnel([
      ["ELIGIBLE_TEAMS", "Eligible Teams", counts.eligibleTeams],
      ["SUBMITTED_TEAMS", "Submitted Teams", submitted],
      ["EVALUATED_TEAMS", "Evaluated Teams", evaluated],
    ]);
    const drops = [
      ...this.getDrops("REGISTRATION", registrationFunnel),
      ...this.getDrops("SUBMISSION", submissionFunnel),
    ];
    return {
      registrationFunnel,
      submissionFunnel,
      largestDrop: drops.sort((a, b) => b.dropCount - a.dropCount)[0] ?? null,
    };
  }

  async getParticipantsByEvent(
    organizerId: number,
    query: ParticipantsByEventQueryDto,
  ) {
    const eventIds = await this.getScopedEventIds(organizerId, query);
    const events = await this.repository.getParticipantsByEvent(eventIds);
    const data = events
      .map((event) => {
        const approvedTeams = event.teams.filter(
          ({ status }) => status === TeamStatus.approved,
        );
        const participants = new Set(
          approvedTeams.flatMap(({ members }) =>
            members.map(({ userId }) => userId),
          ),
        ).size;
        const submittedTeams = new Set(
          approvedTeams.flatMap(({ submissions }) =>
            submissions.map(({ teamId }) => teamId),
          ),
        ).size;
        const capacities = event.tracks.map((track) =>
          track.maxTeams && track.maxMembersPerTeam
            ? track.maxTeams * track.maxMembersPerTeam
            : null,
        );
        const capacity = capacities.every((value) => value !== null)
          ? capacities.reduce<number>((sum, value) => sum + (value ?? 0), 0)
          : null;
        return {
          eventId: event.id,
          eventName: event.name,
          registrations: event.registrations.length,
          participants,
          teamCount: approvedTeams.length,
          submissionCount: submittedTeams,
          capacity,
          capacityRate:
            capacity && capacity > 0
              ? calculatePercentage(participants, capacity)
              : null,
        };
      })
      .sort((a, b) => b.participants - a.participants)
      .slice(0, query.limit ?? 5);
    return { data };
  }

  async getSubmissions(
    organizerId: number,
    query: SubmissionsDashboardQueryDto,
  ) {
    const eventIds = await this.getScopedEventIds(organizerId, query);
    const range = resolveDateRange(query);
    const groupBy = resolveGroupBy(range, query.groupBy);
    const [rows, groupedStatus, eligibleTeams, submittedTeams] =
      await Promise.all([
        this.repository.findSubmissions(eventIds, range.from, range.to),
        this.repository.groupSubmissionStatus(eventIds, range.from, range.to),
        this.repository.countEligibleTeams(eventIds),
        this.repository.countSubmittedTeams(eventIds),
      ]);
    const statusCounts = new Map(
      groupedStatus.map(({ status, _count }) => [status, _count._all]),
    );
    const activity = new Map<
      string,
      { submissionCount: number; teams: Set<number> }
    >();
    for (const row of rows) {
      const key = periodKey(row.submittedAt, groupBy);
      if (!activity.has(key))
        activity.set(key, { submissionCount: 0, teams: new Set() });
      activity.get(key)!.submissionCount++;
      activity.get(key)!.teams.add(row.teamId);
    }
    const evaluated = rows.filter(({ scores }) => scores.length > 0).length;
    const late = rows.filter(
      ({ submittedAt, round }) =>
        round.submissionDeadline && submittedAt > round.submissionDeadline,
    ).length;
    return {
      summary: {
        totalSubmittedTeams: submittedTeams,
        eligibleTeams,
        submissionRate: calculatePercentage(submittedTeams, eligibleTeams),
        submittedLast24Hours: rows.filter(
          ({ submittedAt }) => submittedAt >= new Date(Date.now() - 86_400_000),
        ).length,
        teamsNotSubmitted: Math.max(0, eligibleTeams - submittedTeams),
      },
      submissionStatus: Object.values(SubmissionStatus).map((status) => ({
        status: status.toUpperCase(),
        count: statusCounts.get(status) ?? 0,
      })),
      timingStatus: [
        { status: "ON_TIME", count: rows.length - late },
        { status: "LATE", count: late },
      ],
      evaluationStatus: [
        { status: "NOT_ASSIGNED", count: rows.length - evaluated },
        { status: "PENDING", count: 0 },
        { status: "IN_PROGRESS", count: 0 },
        { status: "EVALUATED", count: evaluated },
      ],
      activity: fillMissingPeriods(
        range,
        groupBy,
        [...activity].map(([period, point]) => ({
          period,
          submissionCount: point.submissionCount,
          uniqueTeamCount: point.teams.size,
        })),
        { submissionCount: 0, uniqueTeamCount: 0 },
      ),
    };
  }

  async getUpcomingDeadlines(
    organizerId: number,
    query: UpcomingDeadlinesQueryDto,
  ) {
    const eventIds = await this.getScopedEventIds(organizerId, query);
    const now = new Date();
    const until = new Date(
      now.getTime() + (query.withinDays ?? 30) * 86_400_000,
    );
    const events = await this.repository.findUpcomingDeadlineEvents(
      eventIds,
      until,
    );
    const deadlines: Array<{
      id: string;
      eventId: number;
      eventName: string;
      roundId: number | null;
      roundName: string | null;
      scheduleId: null;
      type: string;
      title: string;
      deadline: string;
      remainingSeconds: number;
      status: string;
      submittedTeams: number;
      eligibleTeams: number;
      submissionRate: number;
    }> = [];
    for (const event of events) {
      const items = [
        event.registrationDeadline && {
          id: `event-${event.id}-registration`,
          roundId: null,
          roundName: null,
          type: "REGISTRATION_DEADLINE",
          title: "Registration deadline",
          deadline: event.registrationDeadline,
        },
        event.startDate && {
          id: `event-${event.id}-start`,
          roundId: null,
          roundName: null,
          type: "EVENT_START",
          title: "Event start",
          deadline: event.startDate,
        },
        event.endDate && {
          id: `event-${event.id}-end`,
          roundId: null,
          roundName: null,
          type: "EVENT_END",
          title: "Event end",
          deadline: event.endDate,
        },
        ...event.rounds
          .filter(({ submissionDeadline }) => submissionDeadline)
          .map((round) => ({
            id: `round-${round.id}-submission`,
            roundId: round.id,
            roundName: round.name,
            type: "SUBMISSION_DEADLINE",
            title: `${round.name} submission deadline`,
            deadline: round.submissionDeadline!,
            submittedTeams: new Set(
              round.submissions.map(({ teamId }) => teamId),
            ).size,
          })),
      ].filter((item): item is NonNullable<typeof item> => Boolean(item));
      for (const item of items) {
        if (item.deadline > until) continue;
        const eligibleTeams = event.teams.length;
        const submittedTeams =
          "submittedTeams" in item ? item.submittedTeams : 0;
        const remainingSeconds = Math.floor(
          (item.deadline.getTime() - now.getTime()) / 1000,
        );
        deadlines.push({
          ...item,
          eventId: event.id,
          eventName: event.name,
          scheduleId: null,
          deadline: item.deadline.toISOString(),
          remainingSeconds,
          status:
            remainingSeconds < 0
              ? "OVERDUE"
              : remainingSeconds <= 86_400
                ? "URGENT"
                : "UPCOMING",
          submittedTeams,
          eligibleTeams,
          submissionRate: calculatePercentage(submittedTeams, eligibleTeams),
        });
      }
    }
    return {
      data: deadlines
        .sort(
          (a, b) =>
            new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
        )
        .slice(0, query.limit ?? 6),
    };
  }

  async getRecentRegistrations(
    organizerId: number,
    query: RecentRegistrationsQueryDto,
  ) {
    const eventIds = await this.getScopedEventIds(organizerId, query);
    const rows = await this.repository.findRecentRegistrations(
      eventIds,
      query.limit ?? 5,
    );
    return {
      data: rows.map((row) => {
        const membership = row.user.teamMemberships.find(
          ({ team }) => team.eventId === row.event.id,
        );
        const team = membership?.team;
        const status =
          team?.status === TeamStatus.approved
            ? "APPROVED"
            : team?.status === TeamStatus.rejected ||
                team?.status === TeamStatus.disqualified
              ? "REJECTED"
              : "PENDING";
        const maxMembers = team?.track.maxMembersPerTeam ?? null;
        const teamStatus = !row.hasTeam
          ? "NO_TEAM"
          : team?.status === TeamStatus.rejected ||
              team?.status === TeamStatus.disqualified
            ? "TEAM_DISBANDED"
            : maxMembers && team && team.members.length >= maxMembers
              ? "TEAM_FULL"
              : "HAS_TEAM";
        return {
          id: row.id,
          student: {
            id: row.user.id,
            fullName: row.user.name,
            email: row.user.email,
            studentCode: row.user.studentProfile?.studentCode ?? null,
            avatarUrl: row.user.avatarUrl,
          },
          event: row.event,
          registeredAt: row.createdAt.toISOString(),
          status,
          teamStatus,
        };
      }),
    };
  }

  private async getScopedEventIds(
    organizerId: number,
    query: Pick<OrganizerDashboardQueryDto, "eventId" | "season" | "year">,
  ) {
    if (query.eventId) {
      await this.eventAccess.ensureEventAccess(organizerId, query.eventId);
    }
    return this.repository.findScopedEventIds(organizerId, query);
  }

  private buildFunnel(
    values: Array<[key: string, label: string, count: number]>,
  ) {
    const first = values[0]?.[2] ?? 0;
    return values.map(([key, label, count], index) => {
      const previous = index === 0 ? count : values[index - 1][2];
      return {
        key,
        label,
        count,
        overallRate: calculatePercentage(count, first),
        previousStepRate:
          index === 0 ? 100 : calculatePercentage(count, previous),
        dropCount: index === 0 ? 0 : Math.max(0, previous - count),
      };
    });
  }

  private getDrops(
    funnelName: "REGISTRATION" | "SUBMISSION",
    funnel: ReturnType<AnalyticsOrganizerService["buildFunnel"]>,
  ) {
    return funnel.slice(1).map((step, index) => ({
      funnel: funnelName,
      from: funnel[index].label,
      to: step.label,
      dropCount: step.dropCount,
      dropRate: calculatePercentage(step.dropCount, funnel[index].count),
    }));
  }

  private emptyOverview(): DashboardOverview {
    const comparison = {
      value: 0,
      previousValue: 0,
      changePercentage: 0,
      changeDirection: "UNCHANGED" as const,
    };
    return {
      totalEvents: { ...comparison, newEvents: 0 },
      activeEvents: { value: 0, endingSoon: 0, startingSoon: 0 },
      totalRegistrations: { ...comparison, pending: 0 },
      totalParticipants: { ...comparison, approvalRate: 0 },
      totalSubmissions: {
        ...comparison,
        last24Hours: 0,
        pendingEvaluation: 0,
        submissionRate: 0,
      },
    };
  }
}
