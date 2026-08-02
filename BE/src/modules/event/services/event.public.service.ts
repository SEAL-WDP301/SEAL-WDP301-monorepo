import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { EventStatus, TeamStatus } from "@prisma/client";
import { calculatePrizePoolTotals } from "../utils/prize-value.utils";

@Injectable()
export class EventPublicService {
  private readonly logger = new Logger(EventPublicService.name);

  constructor(private readonly prisma: PrismaService) {}

  private withPublicAliases<
    T extends {
      imageUrl?: string | null;
      endDate?: Date | string | null;
      location?: string | null;
      prizes?: Array<{
        amount?: number | null;
        quantity?: number | null;
        currency?: string | null;
      }>;
    },
  >(event: T) {
    let publicLocation = event.location;
    if (publicLocation) {
      try {
        const parsed = JSON.parse(publicLocation) as Record<string, unknown>;
        delete parsed.meetingUrl;
        publicLocation = JSON.stringify(parsed);
      } catch {
        // Plain-text physical locations do not contain private meeting data.
      }
    }

    return {
      ...event,
      location: publicLocation,
      image_url: event.imageUrl ?? null,
      end_date: event.endDate ?? null,
      prizePoolTotals: calculatePrizePoolTotals(event.prizes),
    };
  }

  private withTeamCapacity<
    T extends {
      maxTeams?: number | null;
      imageUrl?: string | null;
      endDate?: Date | string | null;
      location?: string | null;
    },
  >(event: T, registeredTeams: number) {
    const maxTeams = event.maxTeams ?? null;

    return {
      ...this.withPublicAliases(event),
      registeredTeams,
      remainingTeamSlots:
        maxTeams === null ? null : Math.max(0, maxTeams - registeredTeams),
      isTeamRegistrationFull: maxTeams !== null && registeredTeams >= maxTeams,
    };
  }

  async getAllPublicEvents() {
    const events = await this.prisma.event.findMany({
      where: {
        status: {
          in: [EventStatus.active, EventStatus.ongoing, EventStatus.closed],
        },
      },
      include: {
        tracks: true,
        prizes: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (events.length === 0) {
      return [];
    }

    const occupiedByEvent = await this.prisma.team.groupBy({
      by: ["eventId"],
      where: {
        eventId: { in: events.map((event) => event.id) },
        status: { in: [TeamStatus.pending, TeamStatus.approved] },
      },
      _count: { _all: true },
    });
    const occupiedTeamCounts = new Map(
      occupiedByEvent.map((row) => [row.eventId, row._count._all]),
    );

    return events.map((event) =>
      this.withTeamCapacity(
        {
          ...event,
          // List view never needs track details for deferred events.
          tracks: event.deferredTrackAssignment ? [] : event.tracks,
        },
        occupiedTeamCounts.get(event.id) ?? 0,
      ),
    );
  }

  async getPublicEventById(id: number) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        tracks: true,
        rounds: true,
        prizes: true,
        _count: {
          select: {
            teams: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException("Event not found");
    }

    const submissionCount = await this.prisma.submission.count({
      where: {
        round: {
          eventId: id,
        },
      },
    });
    const registeredTeams = await this.prisma.team.count({
      where: {
        eventId: id,
        status: { in: [TeamStatus.pending, TeamStatus.approved] },
      },
    });

    const eventAchievements =
      event.status === EventStatus.closed
        ? await this.prisma.team.findMany({
            where: {
              eventId: id,
              awardId: { not: null },
              status: { not: "disqualified" },
            },
            select: {
              id: true,
              name: true,
              track: { select: { id: true, name: true } },
              award: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  amount: true,
                  placement: true,
                  currency: true,
                },
              },
            },
            orderBy: [{ awardId: "asc" }, { name: "asc" }],
          })
        : [];

    const sanitizedRounds = event.rounds.map((r) => ({
      ...r,
      problemFileUrl: r.status === "not_started" ? null : r.problemFileUrl,
    }));

    const tracksRevealed =
      !event.deferredTrackAssignment ||
      event.rounds.some((round) => round.status !== "not_started");

    return this.withTeamCapacity(
      {
        ...event,
        // Keep track names hidden until the first round leaves "not_started".
        tracks: tracksRevealed ? event.tracks : [],
        rounds: sanitizedRounds,
        eventAchievements,
        _count: {
          teams: event._count.teams,
          submissions: submissionCount,
        },
      },
      registeredTeams,
    );
  }
}
