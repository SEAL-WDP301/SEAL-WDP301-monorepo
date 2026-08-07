import { describe, expect, it } from "vitest";
import {
  canRunProblemLottery,
  countEffectiveAssignedProblems,
  countTeamsOnTracks,
  getCeremonyRound,
  getEffectiveTrackProblemUrl,
  getProblemLotteryDisableReason,
  getTeamLotteryDisableReason,
  isProblemLotteryDone,
  isTeamLotteryDone,
  maxTeamsPerTrack,
} from "./track-capacity";

describe("track-capacity FE helpers", () => {
  it("maxTeamsPerTrack", () => {
    expect(maxTeamsPerTrack(30, 3)).toBe(10);
    expect(maxTeamsPerTrack(10, 3)).toBe(4);
  });

  it("problem lottery disable reasons", () => {
    expect(getProblemLotteryDisableReason(0, 5)).toMatch(/Add at least/);
    expect(getProblemLotteryDisableReason(3, 1)).toMatch(/Upload/);
    expect(getProblemLotteryDisableReason(3, 3)).toBeNull();
    expect(getProblemLotteryDisableReason(4, 4, 3)).toMatch(/Maximum 3/);
    expect(canRunProblemLottery(3, 3)).toBe(true);
  });

  it("blocks repeat Phase 1 and Phase 2", () => {
    expect(
      getProblemLotteryDisableReason(3, 0, 30, true),
    ).toMatch(/Phase 1 has been executed/);
    expect(
      getTeamLotteryDisableReason(3, 30, [{ problemFileUrl: "a.pdf" }], true),
    ).toMatch(/Phase 2 has been executed/);
    expect(isTeamLotteryDone(2, true)).toBe(false);
    expect(isTeamLotteryDone(2, false)).toBe(true);
    expect(isProblemLotteryDone([{ assignedRoundId: 1 }], 3, 0)).toBe(true);
    expect(countTeamsOnTracks([{ _count: { teams: 2 } }])).toBe(2);
  });

  it("team lottery disable reasons", () => {
    expect(getTeamLotteryDisableReason(0, 50, [])).toMatch(/Add at least/);
    expect(getTeamLotteryDisableReason(6, 5, [])).toMatch(/Maximum 5/);
    expect(
      getTeamLotteryDisableReason(3, 50, [
        { problemFileUrl: "a.pdf" },
        { problemFileUrl: null },
      ]),
    ).toMatch(/Phase 1/);
    expect(
      getTeamLotteryDisableReason(3, 50, [
        { problemFileUrl: "a.pdf" },
        { problemFileUrl: "b.pdf" },
        { problemFileUrl: "c.pdf" },
      ]),
    ).toBeNull();
  });

  it("inherits the problem statement from the ceremony round", () => {
    const rounds = [
      {
        id: 1,
        roundNumber: 1,
        trackProblems: [
          { trackId: 10, problemFileUrl: "r1.pdf" },
          { trackId: 11, problemFileUrl: "r1-b.pdf" },
        ],
      },
      {
        id: 2,
        roundNumber: 2,
        trackProblems: [{ trackId: 10, problemFileUrl: null }],
      },
    ];
    expect(getCeremonyRound(rounds)?.roundNumber).toBe(1);
    expect(
      getEffectiveTrackProblemUrl(10, rounds[1], rounds, true),
    ).toBe("r1.pdf");
    expect(
      countEffectiveAssignedProblems([10, 11], rounds[1], rounds, true),
    ).toBe(2);
  });
});
