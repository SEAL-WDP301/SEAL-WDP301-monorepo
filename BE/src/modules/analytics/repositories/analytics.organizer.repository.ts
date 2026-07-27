import { Injectable } from "@nestjs/common";
import {
  EventStatus,
  SubmissionStatus,
  TeamMemberStatus,
  TeamStatus,
} from "@prisma/client";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { OrganizerDashboardQueryDto } from "../dto/organizer-dashboard-query.dto";

@Injectable()
export class AnalyticsOrganizerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findScopedEventIds(
    organizerId: number,
    query: Pick<OrganizerDashboardQueryDto, "eventId" | "season" | "year">,
  ): Promise<number[]> {
    const rows = await this.prisma.event.findMany({
      where: {
        createdById: organizerId,
        ...(query.eventId ? { id: query.eventId } : {}),
        ...(query.season ? { season: query.season } : {}),
        ...(query.year ? { year: query.year } : {}),
      },
      select: { id: true },
    });
    return rows.map(({ id }) => id);
  }

  findFilterOptions(organizerId: number) {
    return this.prisma.event.findMany({
      where: { createdById: organizerId },
      select: { id: true, name: true, season: true, year: true, status: true },
      orderBy: { createdAt: "desc" },
    });
  }

  countEvents(eventIds: number[], from?: Date, to?: Date) {
    return this.prisma.event.count({
      where: {
        id: { in: eventIds },
        ...(from && to ? { createdAt: { gte: from, lt: to } } : {}),
      },
    });
  }

  async getActiveEventSummary(eventIds: number[], now: Date) {
    const sevenDays = new Date(now.getTime() + 7 * 86_400_000);
    const [value, endingSoon, startingSoon] = await Promise.all([
      this.prisma.event.count({
        where: {
          id: { in: eventIds },
          status: { in: [EventStatus.active, EventStatus.ongoing] },
          AND: [
            { OR: [{ startDate: null }, { startDate: { lte: now } }] },
            { OR: [{ endDate: null }, { endDate: { gte: now } }] },
          ],
        },
      }),
      this.prisma.event.count({
        where: {
          id: { in: eventIds },
          endDate: { gte: now, lte: sevenDays },
          status: { in: [EventStatus.active, EventStatus.ongoing] },
        },
      }),
      this.prisma.event.count({
        where: {
          id: { in: eventIds },
          startDate: { gte: now, lte: sevenDays },
        },
      }),
    ]);
    return { value, endingSoon, startingSoon };
  }

  countRegistrations(eventIds: number[], from: Date, to: Date) {
    return this.prisma.studentRegistration.count({
      where: { eventId: { in: eventIds }, createdAt: { gte: from, lt: to } },
    });
  }

  async countApprovedParticipants(eventIds: number[], from: Date, to: Date) {
    if (!eventIds.length) return 0;
    const rows = await this.prisma.studentRegistration.findMany({
      where: {
        eventId: { in: eventIds },
        createdAt: { gte: from, lt: to },
        user: {
          teamMemberships: {
            some: {
              status: TeamMemberStatus.accepted,
              team: { eventId: { in: eventIds }, status: TeamStatus.approved },
            },
          },
        },
      },
      distinct: ["userId"],
      select: { userId: true },
    });
    return rows.length;
  }

  countSubmissions(eventIds: number[], from: Date, to: Date) {
    return this.prisma.submission.count({
      where: {
        round: { eventId: { in: eventIds } },
        submittedAt: { gte: from, lt: to },
      },
    });
  }

  async countSubmittedTeams(eventIds: number[], from?: Date, to?: Date) {
    const rows = await this.prisma.submission.findMany({
      where: {
        round: { eventId: { in: eventIds } },
        ...(from && to ? { submittedAt: { gte: from, lt: to } } : {}),
        status: {
          notIn: [
            SubmissionStatus.flagged_violation,
            SubmissionStatus.disqualified,
          ],
        },
      },
      distinct: ["teamId"],
      select: { teamId: true },
    });
    return rows.length;
  }

  countEligibleTeams(eventIds: number[]) {
    return this.prisma.team.count({
      where: { eventId: { in: eventIds }, status: TeamStatus.approved },
    });
  }

  findEventsForMonthlyChart(eventIds: number[], year: number) {
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year + 1, 0, 1));
    return this.prisma.event.findMany({
      where: {
        id: { in: eventIds },
        OR: [
          { createdAt: { gte: from, lt: to } },
          { startDate: { gte: from, lt: to } },
          { endDate: { gte: from, lt: to } },
        ],
      },
      select: { createdAt: true, startDate: true, endDate: true, status: true },
    });
  }

  findEventStatuses(eventIds: number[]) {
    return this.prisma.event.findMany({
      where: { id: { in: eventIds } },
      select: { status: true, startDate: true, endDate: true },
    });
  }

  findRegistrations(eventIds: number[], from: Date, to: Date) {
    return this.prisma.studentRegistration.findMany({
      where: { eventId: { in: eventIds }, createdAt: { gte: from, lt: to } },
      select: {
        userId: true,
        createdAt: true,
        user: {
          select: {
            teamMemberships: {
              where: {
                status: TeamMemberStatus.accepted,
                team: {
                  eventId: { in: eventIds },
                  status: TeamStatus.approved,
                },
              },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
  }

  async getConversionCounts(eventIds: number[]) {
    const [
      registered,
      approved,
      joined,
      eligibleTeams,
      submittedTeams,
      evaluatedTeams,
    ] = await Promise.all([
      this.prisma.studentRegistration.findMany({
        where: { eventId: { in: eventIds } },
        distinct: ["userId"],
        select: { userId: true },
      }),
      this.prisma.studentRegistration.findMany({
        where: {
          eventId: { in: eventIds },
          user: {
            teamMemberships: {
              some: {
                status: TeamMemberStatus.accepted,
                team: {
                  eventId: { in: eventIds },
                  status: TeamStatus.approved,
                },
              },
            },
          },
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
      this.prisma.teamMember.findMany({
        where: {
          status: TeamMemberStatus.accepted,
          team: {
            eventId: { in: eventIds },
            status: { notIn: [TeamStatus.rejected, TeamStatus.disqualified] },
          },
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
      this.prisma.team.count({
        where: { eventId: { in: eventIds }, status: TeamStatus.approved },
      }),
      this.prisma.submission.findMany({
        where: {
          round: { eventId: { in: eventIds } },
          status: {
            notIn: [
              SubmissionStatus.flagged_violation,
              SubmissionStatus.disqualified,
            ],
          },
        },
        distinct: ["teamId"],
        select: { teamId: true },
      }),
      this.prisma.submission.findMany({
        where: {
          round: { eventId: { in: eventIds } },
          scores: { some: {} },
        },
        distinct: ["teamId"],
        select: { teamId: true },
      }),
    ]);
    return {
      registered: registered.length,
      approved: approved.length,
      joined: joined.length,
      eligibleTeams,
      submittedTeams: submittedTeams.length,
      evaluatedTeams: evaluatedTeams.length,
    };
  }

  async getParticipantsByEvent(eventIds: number[]) {
    const events = await this.prisma.event.findMany({
      where: { id: { in: eventIds } },
      select: {
        id: true,
        name: true,
        registrations: { select: { userId: true } },
        tracks: { select: { maxTeams: true, maxMembersPerTeam: true } },
        teams: {
          where: {
            status: { notIn: [TeamStatus.rejected, TeamStatus.disqualified] },
          },
          select: {
            id: true,
            status: true,
            members: {
              where: { status: TeamMemberStatus.accepted },
              select: { userId: true },
            },
            submissions: {
              where: {
                status: {
                  notIn: [
                    SubmissionStatus.flagged_violation,
                    SubmissionStatus.disqualified,
                  ],
                },
              },
              select: { teamId: true },
            },
          },
        },
      },
    });
    return events;
  }

  groupSubmissionStatus(eventIds: number[], from: Date, to: Date) {
    return this.prisma.submission.groupBy({
      by: ["status"],
      where: {
        round: { eventId: { in: eventIds } },
        submittedAt: { gte: from, lt: to },
      },
      _count: { _all: true },
    });
  }

  findSubmissions(eventIds: number[], from: Date, to: Date) {
    return this.prisma.submission.findMany({
      where: {
        round: { eventId: { in: eventIds } },
        submittedAt: { gte: from, lt: to },
      },
      select: {
        id: true,
        teamId: true,
        status: true,
        submittedAt: true,
        round: { select: { submissionDeadline: true } },
        scores: { select: { id: true }, take: 1 },
      },
      orderBy: { submittedAt: "asc" },
    });
  }

  findUpcomingDeadlineEvents(eventIds: number[], until: Date) {
    return this.prisma.event.findMany({
      where: { id: { in: eventIds } },
      select: {
        id: true,
        name: true,
        registrationDeadline: true,
        startDate: true,
        endDate: true,
        teams: {
          where: { status: TeamStatus.approved },
          select: { id: true },
        },
        rounds: {
          where: { submissionDeadline: { lte: until } },
          select: {
            id: true,
            name: true,
            submissionDeadline: true,
            submissions: {
              where: {
                status: {
                  notIn: [
                    SubmissionStatus.flagged_violation,
                    SubmissionStatus.disqualified,
                  ],
                },
              },
              select: { teamId: true },
            },
          },
        },
      },
    });
  }

  findRecentRegistrations(eventIds: number[], limit: number) {
    return this.prisma.studentRegistration.findMany({
      where: { eventId: { in: eventIds } },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        hasTeam: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            studentProfile: { select: { studentCode: true } },
            teamMemberships: {
              where: { team: { eventId: { in: eventIds } } },
              select: {
                status: true,
                team: {
                  select: {
                    eventId: true,
                    status: true,
                    members: { select: { id: true } },
                    track: { select: { maxMembersPerTeam: true } },
                  },
                },
              },
            },
          },
        },
        event: { select: { id: true, name: true } },
      },
    });
  }

  findRegistrationDetails(registrationId: number) {
    return this.prisma.studentRegistration.findUnique({
      where: { id: registrationId },
      select: {
        id: true,
        userId: true,
        eventId: true,
        hasTeam: true,
        skills: true,
        note: true,
        reviewedAt: true,
        createdAt: true,
        reviewedBy: { select: { id: true, name: true, email: true } },
        track: { select: { id: true, name: true, maxMembersPerTeam: true } },
        event: {
          select: { id: true, name: true, season: true, year: true },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            studentProfile: {
              select: {
                studentCode: true,
                studentType: true,
                universityName: true,
                phone: true,
                githubUsername: true,
              },
            },
            teamMemberships: {
              select: {
                role: true,
                status: true,
                joinedAt: true,
                team: {
                  select: {
                    id: true,
                    eventId: true,
                    name: true,
                    status: true,
                    leaderId: true,
                    updatedAt: true,
                    eliminationReason: true,
                    leader: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true,
                      },
                    },
                    track: { select: { maxMembersPerTeam: true } },
                    members: {
                      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
                      select: {
                        id: true,
                        role: true,
                        status: true,
                        joinedAt: true,
                        user: {
                          select: {
                            id: true,
                            name: true,
                            email: true,
                            avatarUrl: true,
                            studentProfile: {
                              select: {
                                studentCode: true,
                                universityName: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }
}
