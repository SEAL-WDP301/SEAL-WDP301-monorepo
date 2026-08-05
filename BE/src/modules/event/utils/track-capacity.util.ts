/** Max teams per bảng when `maxTeams` teams are spread evenly across tracks. */
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

export function assertTrackCountWithinMaxTeams(
  maxTeams: number | null | undefined,
  trackCount: number,
  context: string,
): void {
  if (maxTeams == null || maxTeams <= 0) return;
  if (trackCount > maxTeams) {
    throw new Error(
      `${context}: ${trackCount} track(s) exceed max teams (${maxTeams}). Each bảng needs at least one team slot — reduce tracks or increase max teams in event settings.`,
    );
  }
}
