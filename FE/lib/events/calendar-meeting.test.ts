import { describe, expect, it } from "vitest";
import { shouldSyncGoogleCalendarMeeting } from "./calendar-meeting";

describe("shouldSyncGoogleCalendarMeeting", () => {
  it("updates an existing meeting while the event is draft", () => {
    expect(
      shouldSyncGoogleCalendarMeeting({
        createGoogleMeet: true,
        eventStatus: "draft",
        hasExistingMeeting: true,
      }),
    ).toBe(true);
  });

  it("waits until ongoing before creating a new meeting", () => {
    expect(
      shouldSyncGoogleCalendarMeeting({
        createGoogleMeet: true,
        eventStatus: "draft",
        hasExistingMeeting: false,
      }),
    ).toBe(false);
    expect(
      shouldSyncGoogleCalendarMeeting({
        createGoogleMeet: true,
        eventStatus: "ongoing",
        hasExistingMeeting: false,
      }),
    ).toBe(true);
  });

  it("does not synchronize when Google Meet is disabled", () => {
    expect(
      shouldSyncGoogleCalendarMeeting({
        createGoogleMeet: false,
        eventStatus: "ongoing",
        hasExistingMeeting: true,
      }),
    ).toBe(false);
  });
});
