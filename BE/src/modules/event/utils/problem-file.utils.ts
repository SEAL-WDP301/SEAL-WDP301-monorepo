type RoundLike = {
  status: string;
  isTrackSpecific?: boolean;
  problemFileUrl?: string | null;
  trackProblems?: Array<{
    trackId: number;
    problemFileUrl?: string | null;
  }>;
};

type RoundForFlowBInheritance = {
  roundNumber: number;
  trackProblems?: Array<{
    trackId: number;
    problemFileUrl?: string | null;
  }>;
};

export function buildFlowBSharedProblemsByTrackId(
  rounds: RoundForFlowBInheritance[],
): Map<number, string> {
  const map = new Map<number, string>();
  for (const round of [...rounds].sort(
    (a, b) => a.roundNumber - b.roundNumber,
  )) {
    for (const tp of round.trackProblems ?? []) {
      const url = tp.problemFileUrl?.trim();
      if (url && !map.has(tp.trackId)) {
        map.set(tp.trackId, url);
      }
    }
  }
  return map;
}

export function resolveProblemFileUrl(
  round: RoundLike,
  teamTrackId?: number | null,
  flowBSharedByTrackId?: Map<number, string> | null,
): string | null {
  if (round.status === "not_started") return null;

  if (round.isTrackSpecific) {
    if (teamTrackId == null) return null;
    const hit = round.trackProblems?.find((p) => p.trackId === teamTrackId);
    const own = hit?.problemFileUrl?.trim();
    if (own) return own;
    return flowBSharedByTrackId?.get(teamTrackId) ?? null;
  }

  return round.problemFileUrl?.trim() || null;
}
