import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { EventStatus } from "@prisma/client";

@Injectable()
export class EventPublicService {
  private readonly logger = new Logger(EventPublicService.name);

  constructor(private readonly prisma: PrismaService) {}

  private withPublicAliases<
    T extends {
      imageUrl?: string | null;
      endDate?: Date | string | null;
      location?: string | null;
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

    return events.map((event) => this.withPublicAliases(event));
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
                select: { id: true, name: true, description: true },
              },
            },
            orderBy: [{ awardId: "asc" }, { name: "asc" }],
          })
        : [];

    const sanitizedRounds = event.rounds.map((r) => ({
      ...r,
      problemFileUrl: r.status === "not_started" ? null : r.problemFileUrl,
    }));

    return this.withPublicAliases({
      ...event,
      rounds: sanitizedRounds,
      eventAchievements,
      _count: {
        teams: event._count.teams,
        submissions: submissionCount,
      },
    });
  }
}
