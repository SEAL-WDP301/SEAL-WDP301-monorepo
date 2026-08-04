import { describe, expect, it } from "vitest";
import {
  ensureRequiredEmailSlots,
  getRequiredEmailGuidance,
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

  it("uses clear guidance when every member email is optional", () => {
    expect(getRequiredEmailGuidance(0)).toBe(
      "All member emails are optional.",
    );
  });

  it("uses singular guidance for one required member email", () => {
    expect(getRequiredEmailGuidance(1)).toBe(
      "The first member email is required.",
    );
  });

  it("rejects an invalid optional email once it has a value", () => {
    expect(validateTeamMemberEmails(["not-an-email"], "leader@test.dev", 0)).toEqual([
      "Enter a valid email address.",
    ]);
  });

  it("allows an empty optional member email", () => {
    expect(validateTeamMemberEmails([""], "leader@test.dev", 0)).toEqual([
      null,
    ]);
  });
});
