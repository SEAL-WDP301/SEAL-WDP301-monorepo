import { PrismaClient, RoundStatus } from "@prisma/client";

type PrismaLike = Pick<PrismaClient, "event" | "round" | "roundTrackProblem">;

export async function isFlowBEvent(
  prisma: PrismaLike,
  eventId: number,
): Promise<boolean> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { deferredTrackAssignment: true },
  });
  return Boolean(event?.deferredTrackAssignment);
}

export async function propagateFlowBTrackProblems(
  prisma: PrismaLike,
  eventId: number,
  sourceRoundId: number,
  assignments: Array<{ trackId: number; problemFileUrl: string }>,
) {
  if (!(await isFlowBEvent(prisma, eventId)) || !assignments.length) return;

  const sourceRound = await prisma.round.findFirst({
    where: { id: sourceRoundId, eventId },
    select: { roundNumber: true },
  });
  if (!sourceRound) return;

  const laterRounds = await prisma.round.findMany({
    where: {
      eventId,
      roundNumber: { gt: sourceRound.roundNumber },
      status: RoundStatus.not_started,
    },
    select: { id: true },
  });

  for (const lr of laterRounds) {
    for (const { trackId, problemFileUrl } of assignments) {
      const row = await prisma.roundTrackProblem.findUnique({
        where: { roundId_trackId: { roundId: lr.id, trackId } },
      });
      if (!row) continue;
      await prisma.roundTrackProblem.update({
        where: { roundId_trackId: { roundId: lr.id, trackId } },
        data: { problemFileUrl },
      });
    }
  }
}

export async function getFlowBInheritedProblemUrl(
  prisma: PrismaLike,
  eventId: number,
  roundId: number,
  trackId: number,
): Promise<string | null> {
  if (!(await isFlowBEvent(prisma, eventId))) return null;

  const round = await prisma.round.findFirst({
    where: { id: roundId, eventId },
    select: { roundNumber: true },
  });
  if (!round) return null;

  const earlierRounds = await prisma.round.findMany({
    where: { eventId, roundNumber: { lt: round.roundNumber } },
    orderBy: { roundNumber: "desc" },
    select: { id: true },
  });

  for (const er of earlierRounds) {
    const tp = await prisma.roundTrackProblem.findUnique({
      where: { roundId_trackId: { roundId: er.id, trackId } },
      select: { problemFileUrl: true },
    });
    const url = tp?.problemFileUrl?.trim();
    if (url) return url;
  }
  return null;
}

export async function resolveEffectiveTrackProblemUrl(
  prisma: PrismaLike,
  eventId: number,
  roundId: number,
  trackId: number,
  ownUrl?: string | null,
): Promise<string | null> {
  const own = ownUrl?.trim();
  if (own) return own;
  return getFlowBInheritedProblemUrl(prisma, eventId, roundId, trackId);
}

export async function clearFlowBLaterRoundProblems(
  prisma: PrismaLike,
  eventId: number,
  sourceRoundId: number,
) {
  if (!(await isFlowBEvent(prisma, eventId))) return;

  const sourceRound = await prisma.round.findFirst({
    where: { id: sourceRoundId, eventId },
    select: { roundNumber: true },
  });
  if (!sourceRound) return;

  await prisma.roundTrackProblem.updateMany({
    where: {
      round: {
        eventId,
        roundNumber: { gt: sourceRound.roundNumber },
        status: RoundStatus.not_started,
      },
    },
    data: { problemFileUrl: null },
  });
}
