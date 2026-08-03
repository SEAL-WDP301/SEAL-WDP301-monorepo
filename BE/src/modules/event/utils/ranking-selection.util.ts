export interface RankingSelectionEntry {
  teamId: number;
  trackId: number;
  finalScore: number | null;
}

export interface RankingSelectionGroup {
  track: { id: number; name: string };
  entries: RankingSelectionEntry[];
}

export interface RankingCutoffTie {
  trackId: number | null;
  trackName: string;
  score: number;
  teamIds: number[];
  slots: number;
}

export interface AdvancementProposal {
  recommendedTeamIds: number[];
  cutoffTies: RankingCutoffTie[];
}

type SelectionScope = {
  trackId: number | null;
  trackName: string;
  entries: RankingSelectionEntry[];
};

function getSelectionScopes(
  groups: RankingSelectionGroup[],
  isTrackSpecific: boolean,
): SelectionScope[] {
  if (isTrackSpecific) {
    return groups.map((group) => ({
      trackId: group.track.id,
      trackName: group.track.name,
      entries: group.entries,
    }));
  }

  return [
    {
      trackId: null,
      trackName: "All Tracks",
      entries: groups.flatMap((group) => group.entries),
    },
  ];
}

function getEligibleEntries(scope: SelectionScope) {
  return scope.entries
    .filter(
      (entry): entry is RankingSelectionEntry & { finalScore: number } =>
        entry.finalScore !== null,
    )
    .sort((a, b) => b.finalScore - a.finalScore);
}

export function buildAdvancementProposal(
  groups: RankingSelectionGroup[],
  limit: number,
  isTrackSpecific: boolean,
): AdvancementProposal {
  const proposal: AdvancementProposal = {
    recommendedTeamIds: [],
    cutoffTies: [],
  };

  for (const scope of getSelectionScopes(groups, isTrackSpecific)) {
    const eligible = getEligibleEntries(scope);
    if (eligible.length <= limit) {
      proposal.recommendedTeamIds.push(
        ...eligible.map((entry) => entry.teamId),
      );
      continue;
    }

    const cutoffScore = eligible[limit - 1].finalScore;
    const aboveCutoff = eligible.filter(
      (entry) => entry.finalScore > cutoffScore,
    );
    const tiedAtCutoff = eligible.filter(
      (entry) => entry.finalScore === cutoffScore,
    );
    const slots = limit - aboveCutoff.length;

    proposal.recommendedTeamIds.push(
      ...aboveCutoff.map((entry) => entry.teamId),
    );

    if (tiedAtCutoff.length > slots) {
      proposal.cutoffTies.push({
        trackId: scope.trackId,
        trackName: scope.trackName,
        score: cutoffScore,
        teamIds: tiedAtCutoff.map((entry) => entry.teamId),
        slots,
      });
    } else {
      proposal.recommendedTeamIds.push(
        ...tiedAtCutoff.slice(0, slots).map((entry) => entry.teamId),
      );
    }
  }

  return proposal;
}

export function getAdvancementSelectionError(
  groups: RankingSelectionGroup[],
  limit: number,
  isTrackSpecific: boolean,
  selectedTeamIds: number[],
): string | null {
  const selected = new Set(selectedTeamIds);
  if (selected.size !== selectedTeamIds.length) {
    return "The selected team list contains duplicates";
  }

  const eligibleIds = new Set(
    groups.flatMap((group) =>
      group.entries
        .filter((entry) => entry.finalScore !== null)
        .map((entry) => entry.teamId),
    ),
  );
  if (selectedTeamIds.some((teamId) => !eligibleIds.has(teamId))) {
    return "One or more selected teams are not eligible for this ranking";
  }

  for (const scope of getSelectionScopes(groups, isTrackSpecific)) {
    const eligible = getEligibleEntries(scope);
    const expectedCount = Math.min(limit, eligible.length);
    const eligibleScopeIds = new Set(eligible.map((entry) => entry.teamId));
    const selectedCount = selectedTeamIds.filter((teamId) =>
      eligibleScopeIds.has(teamId),
    ).length;
    if (selectedCount !== expectedCount) {
      return isTrackSpecific
        ? `Select exactly ${expectedCount} teams from track "${scope.trackName}"`
        : `Select exactly ${expectedCount} teams across all tracks`;
    }
  }

  return null;
}
