import { describe, expect, it } from "vitest";
import {
  ensureRequiredEmailSlots,
  validateTeamMemberEmails,
} from "./team-registration-validation";

describe("team registration email validation", () => {
  it("shows one fewer required email fields than the event minimum team size", () => {
    expect(ensureRequiredEmailSlots([""], 3, 4)).toEqual(["", ""]);
  });

  it("detects duplicate emails after trimming and lowercasing", () => {
    expect(
      validateTeamMemberEmails(
        ["Member@Test.dev", " member@test.dev "],
        "leader@test.dev",
        2,
      ),
    ).toEqual(["This email is duplicated.", "This email is duplicated."]);
  });

  it("requires every fixed email field", () => {
    expect(
      validateTeamMemberEmails(["member@test.dev", ""], "leader@test.dev", 2),
    ).toEqual([null, "Member email is required."]);
  });
});
