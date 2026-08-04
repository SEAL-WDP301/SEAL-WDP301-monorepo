const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeTeamMemberEmail(email: string) {
  return email.trim().toLowerCase();
}

export function ensureRequiredEmailSlots(
  emails: string[],
  minMembersPerTeam: number,
  maxMembersPerTeam: number,
) {
  const requiredSlots = Math.max(0, minMembersPerTeam - 1);
  const maximumSlots = Math.max(requiredSlots, maxMembersPerTeam - 1);
  const result = emails.slice(0, maximumSlots);
  while (result.length < requiredSlots) result.push("");
  return result;
}

export function getRequiredEmailGuidance(requiredSlots: number) {
  if (requiredSlots <= 0) return "All member emails are optional.";
  if (requiredSlots === 1) return "The first member email is required.";
  return `The first ${requiredSlots} member emails are required.`;
}

export function validateTeamMemberEmails(
  emails: string[],
  leaderEmail: string,
  requiredSlots: number,
) {
  const normalized = emails.map(normalizeTeamMemberEmail);
  const counts = normalized.reduce<Map<string, number>>((result, email) => {
    if (email) result.set(email, (result.get(email) ?? 0) + 1);
    return result;
  }, new Map());
  const normalizedLeaderEmail = normalizeTeamMemberEmail(leaderEmail);

  return normalized.map((email, index): string | null => {
    if (!email) {
      return index < requiredSlots ? "Member email is required." : null;
    }
    if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address.";
    if (email === normalizedLeaderEmail) {
      return "You cannot invite your own email address.";
    }
    if ((counts.get(email) ?? 0) > 1) return "This email is duplicated.";
    return null;
  });
}
