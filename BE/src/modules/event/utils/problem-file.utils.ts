type RoundLike = {
  status: string;
  isTrackSpecific?: boolean;
  problemFileUrl?: string | null;
  trackProblems?: Array<{
    trackId: number;
    problemFileUrl?: string | null;
  }>;
};

/**
 * Resolve the problem file a viewer should see for a round + optional team track.
 * Hidden while round is still not_started.
 */
export function resolveProblemFileUrl(
  round: RoundLike,
  teamTrackId?: number | null,
): string | null {
  if (round.status === "not_started") return null;

  if (round.isTrackSpecific && teamTrackId != null && round.trackProblems?.length) {
    const hit = round.trackProblems.find((p) => p.trackId === teamTrackId);
    if (hit?.problemFileUrl) return hit.problemFileUrl;
  }

  return round.problemFileUrl ?? null;
}
