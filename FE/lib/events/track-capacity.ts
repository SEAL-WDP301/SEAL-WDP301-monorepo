/** Max teams per bảng when maxTeams slots are spread evenly. */
export function maxTeamsPerTrack(
  maxTeams: number | null | undefined,
  trackCount: number,
): number | null {
  if (maxTeams == null || maxTeams <= 0 || trackCount <= 0) return null;
  return Math.ceil(maxTeams / trackCount);
}

export function canAddTrackForMaxTeams(
  maxTeams: number | null | undefined,
  currentTrackCount: number,
): boolean {
  if (maxTeams == null || maxTeams <= 0) return true;
  return currentTrackCount + 1 <= maxTeams;
}

export function formatTrackCapacityHint(
  maxTeams: number | null | undefined,
  trackCount: number,
  registeredTeams?: number | null,
): string | null {
  if (maxTeams == null || maxTeams <= 0 || trackCount <= 0) return null;
  const perTrack = maxTeamsPerTrack(maxTeams, trackCount);
  if (perTrack == null) return null;
  const teams =
    registeredTeams != null
      ? ` · ${registeredTeams} teams registered`
      : "";
  return `Max ${maxTeams} teams ÷ ${trackCount} tracks ≈ ${perTrack} teams/track${teams}`;
}

export function countUnassignedPoolItems(
  items: Array<{ assignedRoundId?: number | null }> | undefined,
): number {
  return (items ?? []).filter((item) => item.assignedRoundId == null).length;
}

export function canRunProblemLottery(
  unassignedPoolCount: number,
  trackCount: number,
): boolean {
  return trackCount > 0 && unassignedPoolCount >= trackCount;
}

type CeremonyTrackProblem = {
  problemFileUrl?: string | null;
};

type RoundTrackScope = {
  id?: number;
  roundNumber: number;
  trackProblems?: Array<{
    trackId: number;
    problemFileUrl?: string | null;
  }>;
};

export function getEffectiveTrackProblemUrl(
  trackId: number,
  round: RoundTrackScope,
  allRounds: RoundTrackScope[],
  isDeferred: boolean,
): string | null {
  const own = round.trackProblems
    ?.find((p) => p.trackId === trackId)
    ?.problemFileUrl?.trim();
  if (own) return own;
  if (!isDeferred) return null;
  for (const earlier of [...allRounds]
    .filter((r) => r.roundNumber < round.roundNumber)
    .sort((a, b) => b.roundNumber - a.roundNumber)) {
    const inherited = earlier.trackProblems
      ?.find((p) => p.trackId === trackId)
      ?.problemFileUrl?.trim();
    if (inherited) return inherited;
  }
  return null;
}

export function countEffectiveAssignedProblems(
  trackIds: number[],
  round: RoundTrackScope,
  allRounds: RoundTrackScope[],
  isDeferred: boolean,
): number {
  return trackIds.filter(
    (trackId) =>
      getEffectiveTrackProblemUrl(trackId, round, allRounds, isDeferred) !=
      null,
  ).length;
}

export function getCeremonyRound<T extends RoundTrackScope>(
  rounds: T[],
): T | null {
  return (
    [...rounds]
      .sort((a, b) => a.roundNumber - b.roundNumber)
      .find((r) => (r.trackProblems?.length ?? 0) > 0) ?? null
  );
}

export function countAssignedPoolItems(
  items: Array<{ assignedRoundId?: number | null }> | undefined,
): number {
  return (items ?? []).filter((item) => item.assignedRoundId != null).length;
}

export function countTeamsOnTracks(
  tracks: Array<{ _count?: { teams?: number } }> | undefined,
): number {
  return (tracks ?? []).reduce(
    (sum, track) => sum + (track._count?.teams ?? 0),
    0,
  );
}

export function isProblemLotteryDone(
  poolItems: Array<{ assignedRoundId?: number | null }> | undefined,
  ceremonyTrackCount: number,
  assignedProblemCount: number,
): boolean {
  if (countAssignedPoolItems(poolItems) > 0) return true;
  return ceremonyTrackCount > 0 && assignedProblemCount >= ceremonyTrackCount;
}

export function isTeamLotteryDone(
  teamsOnTracks: number,
  studentTrackDrawOpen?: boolean,
): boolean {
  if (studentTrackDrawOpen) return false;
  return teamsOnTracks > 0;
}

export function getProblemLotteryDisableReason(
  trackCount: number,
  unassignedPoolCount: number,
  maxTeams?: number | null,
  problemLotteryDone?: boolean,
): string | null {
  if (problemLotteryDone) {
    return "Phase 1 has been executed — re-drawing is disabled.";
  }
  if (trackCount <= 0) {
    return "Add at least 1 track to an unstarted round (Not Started).";
  }
  if (maxTeams != null && maxTeams > 0 && trackCount > maxTeams) {
    return `Maximum ${maxTeams} tracks (based on max teams) — reduce tracks or increase max teams.`;
  }
  if (unassignedPoolCount < trackCount) {
    const missing = trackCount - unassignedPoolCount;
    return `Upload ${missing} more problem(s) to the Pool (requires ${trackCount} unassigned, currently ${unassignedPoolCount}).`;
  }
  return null;
}

export function getTeamLotteryDisableReason(
  trackCount: number,
  maxTeams: number | null | undefined,
  trackProblems?: CeremonyTrackProblem[],
  teamLotteryDone?: boolean,
): string | null {
  if (teamLotteryDone) {
    return "Phase 2 has been executed — re-drawing is disabled.";
  }
  if (trackCount <= 0) {
    return "Add at least 1 track to an unstarted round (Not Started).";
  }
  if (maxTeams != null && maxTeams > 0 && trackCount > maxTeams) {
    return `Maximum ${maxTeams} tracks (based on max teams) — reduce tracks or increase max teams.`;
  }
  const missingProblems = (trackProblems ?? []).filter(
    (p) => !p.problemFileUrl?.trim(),
  ).length;
  if (missingProblems > 0) {
    return `Run Random Track (Phase 1) first — ${missingProblems} track(s) missing problem statements.`;
  }
  return null;
}
