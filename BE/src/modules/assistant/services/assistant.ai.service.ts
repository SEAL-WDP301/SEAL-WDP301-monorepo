import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AssistantIntent } from "./assistant.types";

const ALLOWED_INTENTS: AssistantIntent[] = [
  "list_open_events",
  "event_overview",
  "event_deadline",
  "event_faq",
  "event_staff",
  "event_prizes",
  "how_to_register",
  "my_profile",
  "my_registrations",
  "my_team_status",
  "my_awards",
  "my_results",
  "submission_howto",
  "blocked_scoring_config",
  "mentor_my_teams",
  "mentor_pending_feedback",
  "judge_my_assignments",
  "judge_pending_scoring",
  "judge_rubric",
  "org_my_events",
  "org_event_ops",
  "org_rubric",
  "clarify",
  "out_of_scope",
];

@Injectable()
export class AssistantAiService {
  private readonly logger = new Logger(AssistantAiService.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      (this.configService.get<string>("ai.openaiApiKey") || "").trim(),
    );
  }

  async classifyIntent(input: {
    message: string;
    catalog: Array<{ id: number; name: string }>;
    contextEventId?: number;
    focusEventId?: number;
    history?: Array<{ role: string; text: string }>;
    audience?: string;
  }): Promise<{
    intent: AssistantIntent;
    eventIdHint?: number;
    eventNameHint?: string;
    confidence: number;
  } | null> {
    if (!this.isConfigured()) return null;

    const system = `You classify help questions for a hackathon platform assistant.
Return JSON only:
{"intent":string,"eventIdHint":number|null,"eventNameHint":string|null,"confidence":number}
Allowed intents: ${ALLOWED_INTENTS.join(", ")}.
Audience-aware rules:
- audience=guest|student: use student intents; blocked_scoring_config for rubric/how-to-score/admin scoring setup.
- audience=mentor|mentor_judge: mentor_my_teams, mentor_pending_feedback are valid.
- audience=judge|mentor_judge: judge_my_assignments, judge_pending_scoring, judge_rubric are valid (rubric allowed).
- audience=organizer|admin: org_my_events, org_event_ops, org_rubric are valid (setup/rubric allowed for managed events).
- Prefer list_open_events / event_overview / how_to_register / deadlines / faq / staff / prizes for public info.
- my_profile when user asks personal identity/profile ("thông tin của tôi/mình", "tôi tên gì", "profile của tôi", "tài khoản của tôi") — return name/email/role/student profile fields. NOT event registrations.
- my_registrations when user asks about THEIR events/teams ("event của tôi", "team của tôi", "tôi đăng ký event nào") — do NOT ask which open event; do NOT use clarify.
- my_awards for the user's OWN awards: "giải thưởng mà tôi có", "tôi đã đạt giải gì", "những giải của tôi", "my awards". Never clarify / never ask event name for these — never use event_prizes.
- event_prizes ONLY for public prize list of a named/focused event ("event này có giải gì", "giải thưởng Automation Building").
- my_results for the signed-in student's published scores.
- out_of_scope for homework/coding help unrelated to this platform.
- clarify ONLY if a specific public event fact is needed and event is unknown.
- Do not invent event names outside the catalog.
- confidence 0..1.`;

    const parsed = await this.requestJson({
      system,
      user: JSON.stringify({
        message: input.message,
        audience: input.audience || "guest",
        contextEventId: input.contextEventId ?? null,
        focusEventId: input.focusEventId ?? null,
        recentHistory: input.history || [],
        catalog: input.catalog,
      }),
      temperature: 0.1,
      maxTokens: 220,
    });

    if (!parsed || typeof parsed !== "object") return null;
    const row = parsed as Record<string, unknown>;
    const intent = row.intent as AssistantIntent;
    if (!ALLOWED_INTENTS.includes(intent)) return null;

    return {
      intent,
      eventIdHint:
        typeof row.eventIdHint === "number" ? row.eventIdHint : undefined,
      eventNameHint:
        typeof row.eventNameHint === "string" ? row.eventNameHint : undefined,
      confidence:
        typeof row.confidence === "number"
          ? Math.max(0, Math.min(1, row.confidence))
          : 0.5,
    };
  }

  async wording(input: {
    message: string;
    intent: AssistantIntent;
    facts: Record<string, unknown>;
    locale?: "vi" | "en";
  }): Promise<string | null> {
    if (!this.isConfigured()) return null;

    const system = `You write a short helpful assistant reply for hackathon students.
Rules:
- ONLY use provided facts. Never invent deadlines, rules, URLs, or event names.
- 1-4 short sentences. Friendly, clear, not childish.
- Vietnamese by default; English if user message is clearly English or locale=en.
- If intent=my_profile: state the user's name, email, role and profile fields from facts. Do NOT list events/teams/registrations unless asked.
- If intent=my_awards: answer with awardName (+ eventName, teamName, awardDescription) from facts.awards. Do NOT list open events or registration CTAs. If count=0, say no awards recorded yet.
- If intent=my_results: talk about published scores only, not open registration events.
- If facts include descriptionPreview/tracks/rounds/prizes/staff/awards, summarize them (do not ask which event if event is known).
- Never reveal rubric formulas, criterion weights, or admin scoring config.
- Mention linked pages when useful (rules, results, workspace).
- If facts.needsLogin is true, tell them to sign in.
- If facts.missing is true, ask a clarifying question — but never answer a personal-award question by listing open events to register.
- Do not claim you registered them or submitted anything.
Return JSON: {"reply": string}`;

    const parsed = await this.requestJson({
      system,
      user: JSON.stringify({
        userMessage: input.message,
        intent: input.intent,
        locale: input.locale || "vi",
        facts: input.facts,
      }),
      temperature: 0.35,
      maxTokens: 280,
    });

    if (!parsed || typeof parsed !== "object") return null;
    const reply = (parsed as { reply?: unknown }).reply;
    return typeof reply === "string" && reply.trim()
      ? reply.trim().slice(0, 1200)
      : null;
  }

  private async requestJson(input: {
    system: string;
    user: string;
    temperature: number;
    maxTokens: number;
  }): Promise<unknown | null> {
    const apiKey = this.configService.get<string>("ai.openaiApiKey") || "";
    const model =
      this.configService.get<string>("ai.openaiModel") || "gpt-4o-mini";
    const baseUrl =
      this.configService.get<string>("ai.openaiBaseUrl") ||
      "https://api.openai.com/v1";

    try {
      const response = await fetch(
        `${baseUrl.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            temperature: input.temperature,
            max_tokens: input.maxTokens,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: input.system },
              { role: "user", content: input.user },
            ],
          }),
          signal: AbortSignal.timeout(25_000),
        },
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        this.logger.warn(
          `Assistant OpenAI ${response.status}: ${errText.slice(0, 200)}`,
        );
        return null;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;
      return JSON.parse(content);
    } catch (err) {
      this.logger.warn(`Assistant OpenAI failed: ${String(err)}`);
      return null;
    }
  }
}
