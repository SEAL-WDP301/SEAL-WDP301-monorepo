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
 *
 * - Track-specific rounds (incl. Flow B): only the team's track file.
 * - Shared rounds: only round.problemFileUrl (ignore leftover trackProblems).
 */
export function resolveProblemFileUrl(
  round: RoundLike,
  teamTrackId?: number | null,
): string | null {
  if (round.status === "not_started") return null;

  if (round.isTrackSpecific) {
    if (teamTrackId == null || !round.trackProblems?.length) return null;
    const hit = round.trackProblems.find((p) => p.trackId === teamTrackId);
    return hit?.problemFileUrl?.trim() || null;
  }

  return round.problemFileUrl?.trim() || null;
}
