import { describe, expect, it } from "vitest";
import {
  DEFAULT_EVENT_DURATION_DAYS,
  addDaysToLocalDateTimeValue,
  createDefaultEventSchedule,
  createDefaultRoundDeadlines,
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
    expect(
      new Date(schedule.firstRoundDeadline).getTime(),
    ).toBeGreaterThanOrEqual(
      new Date(schedule.startDate).getTime(),
    );
    expect(new Date(schedule.endDate).getTime()).toBeGreaterThanOrEqual(
      new Date(schedule.finalRoundDeadline).getTime(),
    );
    expect(new Date(schedule.finalRoundDeadline).getTime()).toBeGreaterThan(
      new Date(schedule.firstRoundDeadline).getTime(),
    );
    expect(schedule.endDate).toBe(
      addDaysToLocalDateTimeValue(
        schedule.startDate,
        DEFAULT_EVENT_DURATION_DAYS,
      ),
    );
  });

  it("places two round deadlines inside a four-day event", () => {
    const startDate = "2026-08-10T08:00";
    const endDate = "2026-08-14T08:00";

    expect(createDefaultRoundDeadlines(startDate, endDate)).toEqual({
      firstRoundDeadline: "2026-08-12T08:00",
      finalRoundDeadline: "2026-08-14T07:00",
    });
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
