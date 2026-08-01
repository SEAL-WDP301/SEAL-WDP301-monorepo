export type AssistantIntent =
  | "list_open_events"
  | "event_overview"
  | "event_deadline"
  | "event_faq"
  | "event_staff"
  | "event_prizes"
  | "how_to_register"
  | "my_profile"
  | "my_registrations"
  | "my_team_status"
  | "my_awards"
  | "my_results"
  | "submission_howto"
  | "blocked_scoring_config"
  | "mentor_my_teams"
  | "mentor_pending_feedback"
  | "judge_my_assignments"
  | "judge_pending_scoring"
  | "judge_rubric"
  | "org_my_events"
  | "org_event_ops"
  | "org_rubric"
  | "clarify"
  | "out_of_scope";

export type AssistantCard = {
  type: "event" | "action" | "info";
  title: string;
  subtitle?: string;
  href: string;
  primary?: boolean;
};

export type AssistantResolveResult = {
  intent: AssistantIntent;
  facts: Record<string, unknown>;
  cards: AssistantCard[];
  quickReplies: string[];
  needsLogin?: boolean;
  fallbackReply: string;
};
