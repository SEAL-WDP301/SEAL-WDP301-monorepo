import {
  assertTrackCountWithinMaxTeams,
  canAddTrackForMaxTeams,
  maxTeamsPerTrack,
} from "./track-capacity.util";

describe("track-capacity.util", () => {
  it("computes max teams per track", () => {
    expect(maxTeamsPerTrack(30, 3)).toBe(10);
    expect(maxTeamsPerTrack(25, 3)).toBe(9);
    expect(maxTeamsPerTrack(null, 3)).toBeNull();
  });

  it("blocks adding track when at maxTeams cap", () => {
    expect(canAddTrackForMaxTeams(30, 29)).toBe(true);
    expect(canAddTrackForMaxTeams(30, 30)).toBe(false);
    expect(canAddTrackForMaxTeams(null, 100)).toBe(true);
  });

  it("throws when track count exceeds maxTeams", () => {
    expect(() =>
      assertTrackCountWithinMaxTeams(10, 11, "Test"),
    ).toThrow("11 track(s) exceed max teams (10)");
  });
});
