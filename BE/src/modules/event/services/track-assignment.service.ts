import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  RoundResultStatus,
  RoundStatus,
  TeamMemberStatus,
  TeamStatus,
} from "@prisma/client";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { Prisma } from "@prisma/client";

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
   * Evenly shuffle-assign tracks to teams (Flow B / deferred events).
   * - Manual reveal / first open: only teams with null trackId.
   * - Opening a round (`reassignForRoundOpen`): all teams in that round get a
   *   fresh track from the round's track pool (R2+ uses new đề/track, not R1).
   */
  async assignDeferredTracks(
    eventId: number,
    options?: {
      forceReassign?: boolean;
      roundId?: number;
      reassignForRoundOpen?: boolean;
    },
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

    const teamWhere = await this.buildTeamAssignmentWhere(
      eventId,
      options?.roundId,
      options?.reassignForRoundOpen,
      options?.forceReassign,
    );

    const teams = await this.prisma.team.findMany({
      where: teamWhere,
      select: { id: true, name: true, trackId: true },
      orderBy: { id: "asc" },
    });

    const alreadyAssigned =
      options?.reassignForRoundOpen || options?.forceReassign
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

  /** Teams eligible for assignment when a deferred round is opened. */
  private async buildTeamAssignmentWhere(
    eventId: number,
    roundId?: number,
    reassignForRoundOpen?: boolean,
    forceReassign?: boolean,
  ): Promise<Prisma.TeamWhereInput> {
    const base: Prisma.TeamWhereInput = {
      eventId,
      status: { in: [TeamStatus.pending, TeamStatus.approved] },
    };

    if (reassignForRoundOpen && roundId) {
      const rows = await this.prisma.teamRound.findMany({
        where: {
          roundId,
          status: {
            in: [RoundResultStatus.competing, RoundResultStatus.advanced],
          },
          team: base,
        },
        select: { teamId: true },
      });
      const teamIds = rows.map((r) => r.teamId);
      if (teamIds.length) {
        return { id: { in: teamIds } };
      }
      // Fallback: R1 before team_round rows exist — unassigned teams only.
      return { ...base, trackId: null };
    }

    if (forceReassign) {
      return base;
    }

    return { ...base, trackId: null };
  }

  private shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}
