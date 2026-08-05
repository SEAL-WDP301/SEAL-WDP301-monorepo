import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { RoundStatus } from "@prisma/client";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { assertTrackCountWithinMaxTeams } from "../utils/track-capacity.util";
import {
  clearFlowBLaterRoundProblems,
  propagateFlowBTrackProblems,
} from "../utils/flow-b-shared-problems.util";

export type ProblemLotteryAssignment = {
  trackId: number;
  trackName: string;
  poolItemId: number;
  label: string;
  problemFileUrl: string;
};

@Injectable()
export class ProblemPoolService {
  constructor(private readonly prisma: PrismaService) {}

  async listPoolItems(eventId: number) {
    await this.assertDeferredFlowB(eventId);
    return this.prisma.eventProblemPoolItem.findMany({
      where: { eventId },
      orderBy: { id: "asc" },
    });
  }

  async addPoolItem(
    eventId: number,
    dto: { label: string; problemFileUrl: string },
  ) {
    await this.assertDeferredFlowB(eventId);
    const label = dto.label.trim();
    const duplicate = await this.prisma.eventProblemPoolItem.findFirst({
      where: {
        eventId,
        label: { equals: label, mode: "insensitive" },
      },
    });
    if (duplicate) {
      throw new BadRequestException(
        `Pool already has an item named "${label}".`,
      );
    }
    return this.prisma.eventProblemPoolItem.create({
      data: {
        eventId,
        label,
        problemFileUrl: dto.problemFileUrl,
      },
    });
  }

  async removePoolItem(eventId: number, itemId: number) {
    await this.assertDeferredFlowB(eventId);
    const item = await this.prisma.eventProblemPoolItem.findFirst({
      where: { id: itemId, eventId },
    });
    if (!item) throw new NotFoundException("Pool item not found");
    if (item.assignedRoundId != null) {
      throw new BadRequestException(
        "Cannot delete a pool item already assigned to a track.",
      );
    }
    await this.prisma.eventProblemPoolItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  async lotteryAssignProblemsToRound(
    eventId: number,
    roundId: number,
  ): Promise<{ assignments: ProblemLotteryAssignment[] }> {
    await this.assertDeferredFlowB(eventId);
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, eventId },
      include: {
        trackProblems: {
          include: { track: { select: { id: true, name: true } } },
          orderBy: { trackId: "asc" },
        },
      },
    });
    if (!round) throw new NotFoundException("Round not found");
    if (round.status !== RoundStatus.not_started) {
      throw new BadRequestException(
        "Problem lottery is only allowed before the round is opened.",
      );
    }
    if (!round.isTrackSpecific || round.trackProblems.length === 0) {
      throw new BadRequestException(
        "Add tracks to this round before running the problem lottery.",
      );
    }

    const alreadyAssignedPool = await this.prisma.eventProblemPoolItem.count({
      where: { eventId, assignedRoundId: { not: null } },
    });
    if (alreadyAssignedPool > 0) {
      throw new BadRequestException(
        "Phase 1 đã chạy — không thể bốc thăm đề lại.",
      );
    }

    const trackSlots = round.trackProblems;
    const trackCount = trackSlots.length;

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { maxTeams: true },
    });
    try {
      assertTrackCountWithinMaxTeams(
        event?.maxTeams,
        trackCount,
        "Problem lottery",
      );
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    await this.releasePoolAssignmentsForRound(eventId, roundId);

    const available = await this.prisma.eventProblemPoolItem.findMany({
      where: { eventId, assignedRoundId: null },
      orderBy: { id: "asc" },
    });
    if (available.length < trackCount) {
      throw new BadRequestException(
        `Need at least ${trackCount} unassigned pool item(s) for ${trackCount} track(s). Upload more in Problem Pool tab.`,
      );
    }

    const shuffledPool = this.shuffle([...available]).slice(0, trackCount);
    const shuffledTracks = this.shuffle([...trackSlots]);

    const assignments: ProblemLotteryAssignment[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < trackCount; i++) {
        const poolItem = shuffledPool[i];
        const slot = shuffledTracks[i];
        const trackName = slot.track.name;

        await tx.roundTrackProblem.update({
          where: {
            roundId_trackId: { roundId, trackId: slot.trackId },
          },
          data: { problemFileUrl: poolItem.problemFileUrl },
        });

        await tx.eventProblemPoolItem.update({
          where: { id: poolItem.id },
          data: {
            assignedRoundId: roundId,
            assignedTrackId: slot.trackId,
          },
        });

        assignments.push({
          trackId: slot.trackId,
          trackName,
          poolItemId: poolItem.id,
          label: poolItem.label,
          problemFileUrl: poolItem.problemFileUrl,
        });
      }
    });

    await propagateFlowBTrackProblems(
      this.prisma,
      eventId,
      roundId,
      assignments.map((a) => ({
        trackId: a.trackId,
        problemFileUrl: a.problemFileUrl,
      })),
    );

    return { assignments };
  }

  private async releasePoolAssignmentsForRound(
    eventId: number,
    roundId: number,
  ) {
    await clearFlowBLaterRoundProblems(this.prisma, eventId, roundId);

    await this.prisma.eventProblemPoolItem.updateMany({
      where: { assignedRoundId: roundId },
      data: { assignedRoundId: null, assignedTrackId: null },
    });
    await this.prisma.roundTrackProblem.updateMany({
      where: { roundId },
      data: { problemFileUrl: null },
    });
  }

  private async assertDeferredFlowB(eventId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, deferredTrackAssignment: true },
    });
    if (!event) throw new NotFoundException("Event not found");
    if (!event.deferredTrackAssignment) {
      throw new BadRequestException(
        "Problem pool is only available for Flow B events (deferred track assignment).",
      );
    }
  }

  private shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}
