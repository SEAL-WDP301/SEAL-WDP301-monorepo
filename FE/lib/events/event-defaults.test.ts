import { describe, expect, it } from "vitest";
import {
  createDefaultEventSchedule,
  getEventSeason,
} from "./event-defaults";

describe("createDefaultEventSchedule", () => {
  it("creates ordered future dates that satisfy the event form", () => {
    const now = new Date(2026, 7, 4, 14, 30);
    const schedule = createDefaultEventSchedule(now);

    expect(new Date(schedule.registrationDeadline).getTime()).toBeGreaterThan(
      now.getTime(),
    );
    expect(new Date(schedule.startDate).getTime()).toBeGreaterThanOrEqual(
      new Date(schedule.registrationDeadline).getTime(),
    );
    expect(new Date(schedule.roundDeadline).getTime()).toBeGreaterThanOrEqual(
      new Date(schedule.startDate).getTime(),
    );
    expect(new Date(schedule.endDate).getTime()).toBeGreaterThanOrEqual(
      new Date(schedule.roundDeadline).getTime(),
    );
  });
});

describe("getEventSeason", () => {
  it.each([
    [new Date(2026, 0, 1), "Spring"],
    [new Date(2026, 5, 1), "Summer"],
    [new Date(2026, 9, 1), "Fall"],
  ] as const)("maps %s to %s", (date, expected) => {
    expect(getEventSeason(date)).toBe(expected);
  });
});
