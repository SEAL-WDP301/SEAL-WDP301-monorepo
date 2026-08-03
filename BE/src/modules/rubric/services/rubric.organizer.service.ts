import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { CreateRubricDto } from "../dto/create-rubric.dto";
import { RUBRIC_WEIGHT_TOTAL } from "../../../common/utils/scoring.util";

const WEIGHT_EPSILON = 0.01;

@Injectable()
export class RubricOrganizerService {
  constructor(private readonly prisma: PrismaService) {}

  async getRubricsByEvent(eventId: number, roundId?: number, trackId?: number) {
    await this.assertEventExists(eventId);

    return this.prisma.criterion.findMany({
      where: {
        round: { eventId },
        ...(roundId != null ? { roundId } : {}),
        trackId: trackId !== undefined ? trackId : null,
      },
      include: {
        round: true,
        track: true,
      },
      orderBy: [{ roundId: "asc" }, { id: "asc" }],
    });
  }

  async createRubric(eventId: number, userId: number, dto: CreateRubricDto) {
    await this.assertEventExists(eventId);
    const roundId = await this.assertRoundInEvent(eventId, dto.roundId);
    await this.assertCanManageCriteria(eventId, roundId);
    await this.assertWeightBudget(roundId, Number(dto.weight));

    return this.prisma.criterion.create({
      data: {
        name: dto.name,
        description: dto.description,
        maxScore: 10,
        weight: dto.weight,
        roundId,
        trackId: null,
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

    await this.assertEventExists(eventId);

    const roundId = await this.assertRoundInEvent(eventId, dtos[0]?.roundId);
    if (dtos.some((d) => d.roundId != null && d.roundId !== roundId)) {
      throw new BadRequestException(
        "All rubrics in a bulk import must belong to the same round.",
      );
    }

    await this.assertCanManageCriteria(eventId, roundId);

    const addedWeight = dtos.reduce((sum, d) => sum + Number(d.weight), 0);
    await this.assertWeightBudget(roundId, addedWeight);

    await this.prisma.criterion.createMany({
      data: dtos.map((dto) => ({
        createdById,
        name: dto.name,
        description: dto.description,
        maxScore: 10,
        weight: dto.weight,
        roundId,
        trackId: null,
      })),
    });

    return this.getRubricsByEvent(eventId, roundId);
  }

  async updateRubric(eventId: number, rubricId: number, dto: CreateRubricDto) {
    const existing = await this.findRubricInEvent(eventId, rubricId);
    const roundId = await this.assertRoundInEvent(
      eventId,
      dto.roundId ?? existing.roundId,
    );
    await this.assertCanManageCriteria(eventId, roundId);
    await this.assertWeightBudget(roundId, Number(dto.weight), rubricId);

    return this.prisma.criterion.update({
      where: { id: rubricId },
      data: {
        name: dto.name,
        description: dto.description,
        maxScore: 10,
        weight: dto.weight,
        roundId,
        trackId: null,
      },
      include: {
        round: true,
        track: true,
      },
    });
  }

  async deleteRubric(eventId: number, rubricId: number) {
    const existing = await this.findRubricInEvent(eventId, rubricId);
    await this.assertCanManageCriteria(eventId, existing.roundId);

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

    if (existing.some((e) => e.round.eventId !== eventId)) {
      throw new BadRequestException("Criteria belong to different event");
    }

    const roundIds = [...new Set(existing.map((e) => e.roundId))];
    for (const roundId of roundIds) {
      await this.assertCanManageCriteria(eventId, roundId);
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

  private async assertRoundInEvent(
    eventId: number,
    roundId?: number,
  ): Promise<number> {
    if (roundId == null) {
      throw new BadRequestException("roundId is required");
    }
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, eventId },
      select: { id: true },
    });
    if (!round) {
      throw new NotFoundException("Round not found in this event");
    }
    return round.id;
  }

  private async assertEventExists(eventId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) throw new NotFoundException("Event not found");
  }

  private async assertCanManageCriteria(eventId: number, roundId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { status: true },
    });
    if (!event) throw new NotFoundException("Event not found");
    if (event.status === "closed") {
      throw new BadRequestException(
        "Cannot manage grading criteria for closed events.",
      );
    }

    const round = await this.prisma.round.findFirst({
      where: { id: roundId, eventId },
      select: { status: true },
    });
    if (!round) throw new NotFoundException("Round not found in this event");
    if (round.status !== "not_started" && round.status !== "open") {
      throw new BadRequestException(
        "Cannot manage grading criteria after this round has ended.",
      );
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

  private async assertWeightBudget(
    roundId: number,
    addedWeight: number,
    excludeRubricId?: number,
  ) {
    if (!Number.isFinite(addedWeight) || addedWeight <= 0) {
      throw new BadRequestException("Weight (%) must be greater than 0");
    }

    const existing = await this.prisma.criterion.findMany({
      where: {
        roundId,
        trackId: null,
        ...(excludeRubricId ? { id: { not: excludeRubricId } } : {}),
      },
      select: { weight: true },
    });

    const current = existing.reduce((sum, row) => sum + Number(row.weight), 0);
    const next = current + addedWeight;

    if (next > RUBRIC_WEIGHT_TOTAL + WEIGHT_EPSILON) {
      throw new BadRequestException(
        `Criterion weights for this round must total ${RUBRIC_WEIGHT_TOTAL}%. Current ${current.toFixed(2)}% + ${addedWeight}% would be ${next.toFixed(2)}%.`,
      );
    }
  }
}
