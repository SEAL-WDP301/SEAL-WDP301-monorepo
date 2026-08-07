import { axiosClient } from "@/lib/axios";

export type AssistantCard = {
  type: "event" | "action" | "info";
  title: string;
  subtitle?: string;
  href: string;
  primary?: boolean;
};

export type AssistantAudience =
  | "guest"
  | "student"
  | "mentor"
  | "judge"
  | "mentor_judge"
  | "organizer"
  | "admin";

export type AssistantChatResult = {
  reply: string;
  intent: string;
  audience?: AssistantAudience;
  usedAi: { intent: boolean; wording: boolean };
  factsUsed: Record<string, unknown>;
  cards: AssistantCard[];
  quickReplies: string[];
  needsLogin?: boolean;
  focusEventId?: number | null;
};

export async function postAssistantChat(input: {
  message: string;
  locale?: "en";
  context?: {
    eventId?: number;
    focusEventId?: number;
    path?: string;
  };
  history?: Array<{ role: "user" | "assistant"; text: string }>;
}) {
  const response = await axiosClient.post("/assistant/chat", input);
  return (response.data?.data || response.data) as AssistantChatResult;
}

export function quickRepliesForAudience(audience?: AssistantAudience | null) {
  switch (audience) {
    case "mentor":
    case "mentor_judge":
      return [
        "My teams",
        "Teams missing feedback",
        "Open events",
        "My assigned rounds",
      ];
    case "judge":
      return [
        "My assigned rounds",
        "Submissions awaiting review",
        "My round rubric",
        "Open events",
      ];
    case "organizer":
    case "admin":
      return [
        "My events",
        "This event's status",
        "Event rubric and criteria",
        "Open events",
      ];
    case "student":
      return [
        "My profile",
        "My events",
        "My awards",
        "Published scores",
      ];
    default:
      return [
        "Open events",
        "How to register",
        "This event's mentors and judges",
        "Nearest deadline",
      ];
  }
}

export function welcomeForAudience(audience?: AssistantAudience | null) {
  switch (audience) {
    case "mentor":
      return "Hi! I'm the SEAL Assistant for mentors. I can help you review assigned teams, find submissions missing feedback, and navigate mentoring tools. I cannot submit feedback on your behalf.";
    case "judge":
      return "Hi! I'm the SEAL Assistant for judges. I can help you review assigned rounds, find submissions awaiting review, and open the relevant rubric.";
    case "mentor_judge":
      return "Hi! I'm the SEAL Assistant. You are both a mentor and a judge, so you can ask about mentoring teams, submissions awaiting review, or assigned-round rubrics.";
    case "organizer":
    case "admin":
      return "Hi! I'm the SEAL Assistant for organizers. I can help you review managed events, operational status, and configured criteria or rubrics.";
    case "student":
      return "Hi! I'm the SEAL Assistant. I can help you find events, read public information, and navigate registration, submissions, and published results. I cannot register on your behalf or reveal internal judging settings.";
    default:
      return "Hi! I'm the SEAL Assistant. I can help you find events and navigate SEAL according to your account permissions.";
  }
}
