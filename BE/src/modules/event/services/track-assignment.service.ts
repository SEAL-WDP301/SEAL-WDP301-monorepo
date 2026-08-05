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
import { assertTrackCountWithinMaxTeams } from "../utils/track-capacity.util";

export type TrackAssignmentResult = {
  mode?: "bulk" | "student_draw_open" | "student_draw_closed";
  assignedCount: number;
  skippedAlreadyAssigned: number;
  studentTrackDrawOpen?: boolean;
  trackCounts: Array<{ trackId: number; trackName: string; teamCount: number }>;
  assignments: Array<{ teamId: number; teamName: string; trackId: number; trackName: string }>;
};

export type SingleTeamDrawResult = {
  teamId: number;
  teamName: string;
  trackId: number;
  trackName: string;
};

@Injectable()
export class TrackAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evenly shuffle-assign tracks to teams (Flow B / deferred events).
   * - Default: only teams with `trackId: null` (manual reveal or first round open).
   * - Track sticks for the whole event once assigned (SEAL Day-1 lottery).
   * - `reassignForRoundOpen` is legacy/opt-in only — not used on round open.
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
        maxTeams: true,
        deferredTrackAssignment: true,
        tracks: { select: { id: true, name: true }, orderBy: { id: "asc" } },
      },
    });
    if (!event) throw new NotFoundException("Event not found");
    if (!event.deferredTrackAssignment) {
      throw new BadRequestException(
        "This event does not use deferred track assignment.",
      );
    }

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
        mode: "bulk",
        assignedCount: 0,
        skippedAlreadyAssigned: 0,
        trackCounts: [],
        assignments: [],
      };
    }

    try {
      assertTrackCountWithinMaxTeams(
        event.maxTeams,
        assignmentTracks.length,
        "Track assignment",
      );
    } catch (err) {
      throw new BadRequestException((err as Error).message);
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
        mode: "bulk",
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
      mode: "bulk",
      trackCounts: assignmentTracks.map((t) => ({
        trackId: t.id,
        trackName: t.name,
        teamCount: counts.get(t.id) || 0,
      })),
      assignments: plan,
    };
  }

  async openStudentTrackDraw(
    eventId: number,
    roundId?: number,
  ): Promise<TrackAssignmentResult> {
    const event = await this.loadDeferredEvent(eventId);
    if (roundId != null) {
      await this.assertCeremonyRound(eventId, roundId);
    }

    if (!event.studentTrackDrawOpen) {
      await this.assertCeremonyTeamLotteryNotYetRun(eventId);
    }

    await this.prisma.event.update({
      where: { id: eventId },
      data: { studentTrackDrawOpen: true },
    });

    const trackCounts = await this.getCurrentTrackCounts(
      eventId,
      await this.resolveAssignmentTracks(eventId, roundId),
    );

    const pending = await this.prisma.team.count({
      where: {
        eventId,
        status: { in: [TeamStatus.pending, TeamStatus.approved] },
        trackId: null,
      },
    });

    return {
      mode: "student_draw_open",
      assignedCount: 0,
      skippedAlreadyAssigned: 0,
      studentTrackDrawOpen: true,
      trackCounts,
      assignments: [],
    };
  }

  async closeStudentTrackDraw(eventId: number): Promise<TrackAssignmentResult> {
    await this.loadDeferredEvent(eventId);

    await this.prisma.event.update({
      where: { id: eventId },
      data: { studentTrackDrawOpen: false, studentSelfTrackDraw: false },
    });

    const tracks = await this.prisma.track.findMany({
      where: { eventId },
      orderBy: { id: "asc" },
    });
    const trackCounts = await this.getCurrentTrackCounts(eventId, tracks);

    const assignments = await this.listAssignedTeams(eventId);

    return {
      mode: "student_draw_closed",
      assignedCount: assignments.length,
      skippedAlreadyAssigned: 0,
      studentTrackDrawOpen: false,
      trackCounts,
      assignments,
    };
  }

  /** One team self-draw — picks among tracks with the fewest teams (balanced random). */
  async drawTrackForTeam(
    eventId: number,
    teamId: number,
    userId: number,
    roundId?: number,
  ): Promise<SingleTeamDrawResult> {
    const event = await this.loadDeferredEvent(eventId);
    if (!event.studentSelfTrackDraw) {
      throw new BadRequestException(
        "This event does not use student self-draw track assignment.",
      );
    }
    if (!event.studentTrackDrawOpen) {
      throw new BadRequestException(
        "Track draw phase is not open yet. Wait for the organizer to start Phase 2.",
      );
    }

    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        eventId,
        status: { in: [TeamStatus.pending, TeamStatus.approved] },
      },
      select: { id: true, name: true, leaderId: true, trackId: true },
    });
    if (!team) throw new NotFoundException("Team not found for this event");
    if (team.leaderId !== userId) {
      throw new BadRequestException("Only the team leader can draw a track.");
    }
    if (team.trackId != null) {
      const track = await this.prisma.track.findUnique({
        where: { id: team.trackId },
        select: { id: true, name: true },
      });
      if (!track) throw new BadRequestException("Team already has a track.");
      return {
        teamId: team.id,
        teamName: team.name,
        trackId: track.id,
        trackName: track.name,
      };
    }

    const assignmentTracks = await this.resolveAssignmentTracks(
      eventId,
      roundId,
    );
    if (!assignmentTracks.length) {
      throw new BadRequestException(
        "No tracks configured for this round yet.",
      );
    }

    const counts = await this.getTrackCountMap(eventId, assignmentTracks);
    const minCount = Math.min(...assignmentTracks.map((t) => counts.get(t.id) ?? 0));
    const eligible = assignmentTracks.filter(
      (t) => (counts.get(t.id) ?? 0) === minCount,
    );
    const picked = eligible[Math.floor(Math.random() * eligible.length)];

    await this.prisma.team.update({
      where: { id: team.id },
      data: { trackId: picked.id },
    });

    const memberUserIds = (
      await this.prisma.teamMember.findMany({
        where: {
          teamId: team.id,
          status: { not: TeamMemberStatus.rejected },
        },
        select: { userId: true },
      })
    ).map((m) => m.userId);

    if (memberUserIds.length) {
      await this.prisma.studentRegistration.updateMany({
        where: { eventId, userId: { in: memberUserIds } },
        data: { trackId: picked.id },
      });
    }

    return {
      teamId: team.id,
      teamName: team.name,
      trackId: picked.id,
      trackName: picked.name,
    };
  }

  async getStudentDrawStatus(
    eventId: number,
    roundId?: number,
  ): Promise<TrackAssignmentResult> {
    const event = await this.loadDeferredEvent(eventId);
    const tracks = await this.resolveAssignmentTracks(eventId, roundId);
    const trackCounts = await this.getCurrentTrackCounts(eventId, tracks);
    const assignments = await this.listAssignedTeams(eventId);
    const pending = await this.prisma.team.count({
      where: {
        eventId,
        status: { in: [TeamStatus.pending, TeamStatus.approved] },
        trackId: null,
      },
    });

    return {
      mode: event.studentTrackDrawOpen ? "student_draw_open" : "bulk",
      assignedCount: assignments.length,
      skippedAlreadyAssigned: pending,
      studentTrackDrawOpen: event.studentTrackDrawOpen,
      trackCounts,
      assignments,
    };
  }

  private async loadDeferredEvent(eventId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        deferredTrackAssignment: true,
        studentSelfTrackDraw: true,
        studentTrackDrawOpen: true,
      },
    });
    if (!event) throw new NotFoundException("Event not found");
    if (!event.deferredTrackAssignment) {
      throw new BadRequestException(
        "This event does not use deferred track assignment.",
      );
    }
    return event;
  }

  async assertCeremonyTeamLotteryNotYetRun(eventId: number) {
    const assignedCount = await this.prisma.team.count({
      where: {
        eventId,
        status: { in: [TeamStatus.pending, TeamStatus.approved] },
        trackId: { not: null },
      },
    });
    if (assignedCount > 0) {
      throw new BadRequestException(
        "Phase 2 đã chạy — không thể bốc thăm đội lại.",
      );
    }
  }

  private async resolveAssignmentTracks(eventId: number, roundId?: number) {
    if (roundId != null) {
      return (
        await this.prisma.roundTrackProblem.findMany({
          where: { roundId },
          select: { track: { select: { id: true, name: true } } },
          orderBy: { trackId: "asc" },
        })
      ).map((p) => p.track);
    }
    return this.prisma.track.findMany({
      where: { eventId },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
  }

  private async assertCeremonyRound(eventId: number, roundId: number) {
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, eventId },
      select: { id: true, status: true, name: true },
    });
    if (!round) throw new NotFoundException("Round not found in this event");
    if (round.status !== RoundStatus.not_started) {
      throw new BadRequestException(
        `Team lottery is only allowed before "${round.name}" is opened.`,
      );
    }
  }

  private async getTrackCountMap(
    eventId: number,
    tracks: Array<{ id: number }>,
  ) {
    const counts = new Map<number, number>();
    for (const track of tracks) counts.set(track.id, 0);
    const rows = await this.prisma.team.groupBy({
      by: ["trackId"],
      where: {
        eventId,
        status: { in: [TeamStatus.pending, TeamStatus.approved] },
        trackId: { in: tracks.map((t) => t.id) },
      },
      _count: { _all: true },
    });
    for (const row of rows) {
      if (row.trackId != null) counts.set(row.trackId, row._count._all);
    }
    return counts;
  }

  private async getCurrentTrackCounts(
    eventId: number,
    tracks: Array<{ id: number; name: string }>,
  ) {
    const counts = await this.getTrackCountMap(eventId, tracks);
    return tracks.map((t) => ({
      trackId: t.id,
      trackName: t.name,
      teamCount: counts.get(t.id) ?? 0,
    }));
  }

  private async listAssignedTeams(eventId: number) {
    const teams = await this.prisma.team.findMany({
      where: {
        eventId,
        status: { in: [TeamStatus.pending, TeamStatus.approved] },
        trackId: { not: null },
      },
      select: {
        id: true,
        name: true,
        trackId: true,
        track: { select: { name: true } },
      },
      orderBy: { id: "asc" },
    });
    return teams.map((t) => ({
      teamId: t.id,
      teamName: t.name,
      trackId: t.trackId!,
      trackName: t.track?.name ?? "",
    }));
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
