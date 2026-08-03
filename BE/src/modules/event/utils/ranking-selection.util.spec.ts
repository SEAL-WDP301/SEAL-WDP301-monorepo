import {
  buildAdvancementProposal,
  getAdvancementSelectionError,
  type RankingSelectionGroup,
} from "./ranking-selection.util";

const groups: RankingSelectionGroup[] = [
  {
    track: { id: 1, name: "AI" },
    entries: [
      { teamId: 1, trackId: 1, finalScore: 9 },
      { teamId: 2, trackId: 1, finalScore: 8 },
      { teamId: 3, trackId: 1, finalScore: 7 },
    ],
  },
  {
    track: { id: 2, name: "Web" },
    entries: [
      { teamId: 4, trackId: 2, finalScore: 9.5 },
      { teamId: 5, trackId: 2, finalScore: 8.5 },
      { teamId: 6, trackId: 2, finalScore: 6 },
    ],
  },
];

describe("ranking selection", () => {
  it("selects the configured number from every track", () => {
    const result = buildAdvancementProposal(groups, 2, true);

    expect(result.recommendedTeamIds).toEqual([1, 2, 4, 5]);
    expect(result.cutoffTies).toEqual([]);
  });

  it("selects the configured number across the event for a global round", () => {
    const result = buildAdvancementProposal(groups, 3, false);

    expect(result.recommendedTeamIds).toEqual([4, 1, 5]);
    expect(result.cutoffTies).toEqual([]);
  });

  it("leaves cutoff slots unresolved when teams are tied", () => {
    const tiedGroups: RankingSelectionGroup[] = [
      {
        track: { id: 1, name: "AI" },
        entries: [
          { teamId: 1, trackId: 1, finalScore: 9 },
          { teamId: 2, trackId: 1, finalScore: 8 },
          { teamId: 3, trackId: 1, finalScore: 8 },
          { teamId: 4, trackId: 1, finalScore: 7 },
        ],
      },
    ];

    const result = buildAdvancementProposal(tiedGroups, 2, true);

    expect(result.recommendedTeamIds).toEqual([1]);
    expect(result.cutoffTies).toEqual([
      {
        trackId: 1,
        trackName: "AI",
        score: 8,
        teamIds: [2, 3],
        slots: 1,
      },
    ]);
  });

  it("rejects selections that do not match the configured per-track limit", () => {
    expect(getAdvancementSelectionError(groups, 2, true, [1, 2, 4])).toBe(
      'Select exactly 2 teams from track "Web"',
    );
    expect(getAdvancementSelectionError(groups, 2, true, [1, 2, 4, 99])).toBe(
      "One or more selected teams are not eligible for this ranking",
    );
  });

  it("accepts an organizer's manual choice for a tied cutoff slot", () => {
    const tiedGroups: RankingSelectionGroup[] = [
      {
        track: { id: 1, name: "AI" },
        entries: [
          { teamId: 1, trackId: 1, finalScore: 9 },
          { teamId: 2, trackId: 1, finalScore: 8 },
          { teamId: 3, trackId: 1, finalScore: 8 },
        ],
      },
    ];

    expect(getAdvancementSelectionError(tiedGroups, 2, true, [1, 2])).toBe(
      null,
    );
  });
});
