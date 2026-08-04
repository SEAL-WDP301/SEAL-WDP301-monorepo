import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { RoundStatus, TeamMemberStatus, TeamStatus } from "@prisma/client";
import { PrismaService } from "../../../database/prisma/prisma.service";

export type TrackAssignmentResult = {
  assignedCount: number;
  skippedAlreadyAssigned: number;
  trackCounts: Array<{ trackId: number; trackName: string; teamCount: number }>;
  assignments: Array<{ teamId: number; teamName: string; trackId: number; trackName: string }>;
};

@Injectable()
export class TrackAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evenly shuffle-assign event tracks to teams that still have null trackId.
   * Only pending/approved teams are considered.
   */
  async assignDeferredTracks(
    eventId: number,
    options?: { forceReassign?: boolean; roundId?: number },
  ): Promise<TrackAssignmentResult> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        deferredTrackAssignment: true,
        tracks: { select: { id: true, name: true }, orderBy: { id: "asc" } },
      },
    });
    if (!event) throw new NotFoundException("Event not found");

    const assignmentTracks = options?.roundId
      ? (
          await this.prisma.roundTrackProblem.findMany({
            where: { roundId: options.roundId },
            select: { track: { select: { id: true, name: true } } },
            orderBy: { trackId: "asc" },
          })
        ).map((p) => p.track)
      : event.tracks;

    if (options?.forceReassign) {
      const startedRounds = await this.prisma.round.count({
        where: {
          eventId,
          status: { not: RoundStatus.not_started },
        },
      });
      if (startedRounds > 0) {
        throw new BadRequestException(
          "Cannot force-reassign tracks after a round has started.",
        );
      }
    }

    if (!assignmentTracks.length) {
      return {
        assignedCount: 0,
        skippedAlreadyAssigned: 0,
        trackCounts: [],
        assignments: [],
      };
    }

    const teams = await this.prisma.team.findMany({
      where: {
        eventId,
        status: { in: [TeamStatus.pending, TeamStatus.approved] },
        ...(options?.forceReassign ? {} : { trackId: null }),
      },
      select: { id: true, name: true, trackId: true },
      orderBy: { id: "asc" },
    });

    const alreadyAssigned = options?.forceReassign
      ? 0
      : await this.prisma.team.count({
          where: {
            eventId,
            status: { in: [TeamStatus.pending, TeamStatus.approved] },
            trackId: { not: null },
          },
        });

    if (!teams.length) {
      return {
        assignedCount: 0,
        skippedAlreadyAssigned: alreadyAssigned,
        trackCounts: assignmentTracks.map((t) => ({
          trackId: t.id,
          trackName: t.name,
          teamCount: 0,
        })),
        assignments: [],
      };
    }

    const shuffled = this.shuffle([...teams]);
    const trackIds = assignmentTracks.map((t) => t.id);
    const plan = shuffled.map((team, index) => ({
      teamId: team.id,
      teamName: team.name,
      trackId: trackIds[index % trackIds.length],
      trackName:
        assignmentTracks.find((t) => t.id === trackIds[index % trackIds.length])
          ?.name ?? "",
    }));

    await this.prisma.$transaction(
      plan.map((row) =>
        this.prisma.team.update({
          where: { id: row.teamId },
          data: { trackId: row.trackId },
        }),
      ),
    );

    // Keep student_registrations in sync for team members
    for (const row of plan) {
      const memberUserIds = (
        await this.prisma.teamMember.findMany({
          where: {
            teamId: row.teamId,
            status: { not: TeamMemberStatus.rejected },
          },
          select: { userId: true },
        })
      ).map((m) => m.userId);

      if (memberUserIds.length) {
        await this.prisma.studentRegistration.updateMany({
          where: {
            eventId,
            userId: { in: memberUserIds },
          },
          data: { trackId: row.trackId },
        });
      }
    }

    const counts = new Map<number, number>();
    for (const row of plan) {
      counts.set(row.trackId, (counts.get(row.trackId) || 0) + 1);
    }

    return {
      assignedCount: plan.length,
      skippedAlreadyAssigned: alreadyAssigned,
      trackCounts: assignmentTracks.map((t) => ({
        trackId: t.id,
        trackName: t.name,
        teamCount: counts.get(t.id) || 0,
      })),
      assignments: plan,
    };
  }

  private shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}
