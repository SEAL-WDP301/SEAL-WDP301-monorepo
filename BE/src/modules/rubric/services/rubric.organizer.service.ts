import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { CreateRubricDto } from "../dto/create-rubric.dto";

@Injectable()
export class RubricOrganizerService {
  constructor(private readonly prisma: PrismaService) {}

  async getRubricsByEvent(eventId: number, roundId?: number, trackId?: number) {
    await this.assertEventExists(eventId);

    return this.prisma.criterion.findMany({
      where: {
        round: { eventId },
        ...(roundId !== undefined && { roundId }),
        ...(trackId !== undefined && { trackId }),
      },
      include: {
        round: true,
        track: true,
      },
      orderBy: [{ roundId: "asc" }, { id: "asc" }],
    });
  }

  async createRubric(eventId: number, userId: number, dto: CreateRubricDto) {
    await this.assertRoundBelongsToEvent(dto.roundId, eventId);
    await this.assertRoundNotStarted(dto.roundId);

    if (dto.trackId != null) {
      await this.assertTrackBelongsToEvent(dto.trackId, eventId);
    }

    return this.prisma.criterion.create({
      data: {
        name: dto.name,
        description: dto.description,
        maxScore: dto.maxScore,
        weight: dto.weight,
        roundId: dto.roundId,
        trackId: dto.trackId ?? null,
        createdById: userId,
      },
      include: {
        round: true,
        track: true,
      },
    });
  }

  async bulkCreateRubrics(
    eventId: number,
    createdById: number,
    dtos: CreateRubricDto[],
  ) {
    if (!dtos || dtos.length === 0) return [];

    const roundIds = [...new Set(dtos.map((d) => d.roundId))];
    const trackIds = [
      ...new Set(dtos.map((d) => d.trackId).filter((id) => id != null)),
    ];

    for (const roundId of roundIds) {
      await this.assertRoundBelongsToEvent(roundId, eventId);
      await this.assertRoundNotStarted(roundId);
    }

    for (const trackId of trackIds) {
      await this.assertTrackBelongsToEvent(trackId, eventId);
    }

    const createData = dtos.map((dto) => ({
      createdById,
      name: dto.name,
      description: dto.description,
      maxScore: dto.maxScore,
      weight: dto.weight,
      roundId: dto.roundId,
      trackId: dto.trackId ?? null,
    }));

    await this.prisma.criterion.createMany({
      data: createData,
    });

    return this.prisma.criterion.findMany({
      where: { roundId: { in: roundIds } },
      include: { round: true, track: true },
    });
  }

  async updateRubric(eventId: number, rubricId: number, dto: CreateRubricDto) {
    const existing = await this.findRubricInEvent(eventId, rubricId);
    await this.assertRoundNotStarted(existing.roundId);

    if (dto.roundId !== existing.roundId) {
      await this.assertRoundBelongsToEvent(dto.roundId, eventId);
      await this.assertRoundNotStarted(dto.roundId);
    }

    if (dto.trackId != null) {
      await this.assertTrackBelongsToEvent(dto.trackId, eventId);
    }

    return this.prisma.criterion.update({
      where: { id: rubricId },
      data: {
        name: dto.name,
        description: dto.description,
        maxScore: dto.maxScore,
        weight: dto.weight,
        roundId: dto.roundId,
        trackId: dto.trackId ?? null,
      },
      include: {
        round: true,
        track: true,
      },
    });
  }

  async deleteRubric(eventId: number, rubricId: number) {
    const existing = await this.findRubricInEvent(eventId, rubricId);
    await this.assertRoundNotStarted(existing.roundId);

    const scoreCount = await this.prisma.score.count({
      where: { criterionId: rubricId },
    });

    if (scoreCount > 0) {
      throw new BadRequestException(
        "Cannot delete a criterion that already has scores",
      );
    }

    await this.prisma.criterion.delete({ where: { id: rubricId } });
  }

  async bulkDeleteRubrics(eventId: number, rubricIds: number[]) {
    if (!rubricIds?.length) return;

    const existing = await this.prisma.criterion.findMany({
      where: { id: { in: rubricIds } },
      include: { round: true },
    });

    if (existing.length !== rubricIds.length) {
      throw new BadRequestException("Some criteria not found");
    }

    const eventIds = [...new Set(existing.map((e) => e.round.eventId))];
    if (eventIds.some((id) => id !== eventId)) {
      throw new BadRequestException("Criteria belong to different event");
    }

    for (const item of existing) {
      if (item.round.status !== "not_started" && item.round.status !== "open") {
        throw new BadRequestException(
          `Round ${item.round.name} has already ended`,
        );
      }
    }

    const scoreCount = await this.prisma.score.count({
      where: { criterionId: { in: rubricIds } },
    });

    if (scoreCount > 0) {
      throw new BadRequestException(
        "Cannot delete criteria that already have scores",
      );
    }

    await this.prisma.criterion.deleteMany({
      where: { id: { in: rubricIds } },
    });
  }

  private async assertEventExists(eventId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException("Event not found");
    }
  }

  private async assertRoundNotStarted(roundId: number) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      include: { event: { select: { status: true } } },
    });

    if (!round) {
      throw new NotFoundException("Round not found");
    }

    if (round.event.status === "closed") {
      throw new BadRequestException(
        "Cannot manage grading criteria for closed events.",
      );
    }

    if (round.status !== "not_started" && round.status !== "open") {
      throw new BadRequestException(
        "Can only manage grading criteria for rounds that have not started or are currently open.",
      );
    }
  }

  private async assertRoundBelongsToEvent(roundId: number, eventId: number) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true, eventId: true },
    });

    if (!round || round.eventId !== eventId) {
      throw new BadRequestException("Round does not belong to this event");
    }
  }

  private async assertTrackBelongsToEvent(trackId: number, eventId: number) {
    const track = await this.prisma.track.findUnique({
      where: { id: trackId },
      select: { id: true, eventId: true },
    });

    if (!track || track.eventId !== eventId) {
      throw new BadRequestException("Track does not belong to this event");
    }
  }

  private async findRubricInEvent(eventId: number, rubricId: number) {
    const rubric = await this.prisma.criterion.findFirst({
      where: {
        id: rubricId,
        round: { eventId },
      },
    });

    if (!rubric) {
      throw new NotFoundException("Criterion not found in this event");
    }

    return rubric;
  }
}
