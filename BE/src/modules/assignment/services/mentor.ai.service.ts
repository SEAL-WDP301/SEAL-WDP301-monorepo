import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { SubmissionAiService } from "../../submission/services/submission.ai.service";

export type MentorReadiness =
  | "strong"
  | "needs_work"
  | "at_risk"
  | "no_submission";

export type MentorAiDraftResult = {
  submissionId: number;
  teamId: number;
  teamName: string;
  source: "file" | "github_link";
  contextSummary: string;
  overview: string;
  readiness: MentorReadiness;
  strengths: string[];
  risks: string[];
  questionsToAsk: string[];
  focusNext: string;
  draftFeedback: string;
};

export type MentorAiOverviewTeam = {
  teamId: number;
  teamName: string;
  trackName: string | null;
  priority: "high" | "medium" | "low";
  reason: string;
  focus: string;
  readiness: MentorReadiness;
  latestSubmissionId: number | null;
  latestRoundName: string | null;
  hasFeedback: boolean;
  unreadChatCount: number;
};

export type MentorAiOverviewResult = {
  summary: string;
  stats: {
    totalTeams: number;
    withSubmission: number;
    missingFeedback: number;
    noSubmission: number;
    highPriority: number;
  };
  priorityTeams: MentorAiOverviewTeam[];
};

type TeamCard = {
  teamId: number;
  teamName: string;
  trackName: string | null;
  teamStatus: string | null;
  latestSubmissionId: number | null;
  latestRoundName: string | null;
  submissionType: string | null;
  hasFile: boolean;
  hasGithub: boolean;
  descriptionPreview: string;
  hasFeedback: boolean;
  feedbackStatus: string | null;
  unreadChatCount: number;
  roundStatuses: string[];
};

@Injectable()
export class MentorAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly submissionAi: SubmissionAiService,
  ) {}

  async draftFeedback(
    mentorId: number,
    submissionId: number,
  ): Promise<MentorAiDraftResult> {
    await this.ensureMentorCanAccessSubmission(mentorId, submissionId);
    const apiKey = this.submissionAi.requireOpenAiApiKey();
    const evidence =
      await this.submissionAi.collectSubmissionEvidence(submissionId);

    const system = `You are a mentoring copilot for hackathon mentors (NOT a judge).
Help the mentor quickly understand one team's submission and draft constructive coaching feedback.
Rules:
- Do NOT invent scores, rankings, or rubric grades.
- Do NOT invent product features, APIs, or file contents that are not in the evidence.
- Be specific and actionable; cite concrete signals from evidence when possible.
- Prefer English unless the submission text is clearly Vietnamese — then match Vietnamese.
- strengths MUST always include 1-3 items. If code/docs evidence is thin or unreadable, use honest process strengths (e.g. submitted a package, included a description, chose a delivery format) — never return an empty strengths array.
- risks should cover gaps/blockers; keep coaching tone, not punishment tone.
- Output JSON only with keys:
  overview (string, 2-3 sentences snapshot),
  readiness ("strong"|"needs_work"|"at_risk"),
  strengths (string[] 1-4 items, required),
  risks (string[] max 4),
  questionsToAsk (string[] max 5 — questions mentor should ask the team),
  focusNext (string, one short decision line for the mentor),
  draftFeedback (string, ready-to-send mentor feedback in 2-4 short paragraphs, coaching tone; mention at least one strength before asking for fixes).`;

    const userPayload = {
      team: evidence.teamName,
      event: evidence.eventName,
      round: evidence.roundName,
      track: evidence.trackName,
      submissionType: evidence.source,
      contextSummary: evidence.contextSummary,
      teamDescription: evidence.description || "",
      evidence: evidence.evidenceText,
      links: {
        fileUrl: evidence.fileUrl,
        githubUrl: evidence.githubUrl,
      },
    };

    const parsed = (await this.submissionAi.requestJsonCompletion({
      apiKey,
      system,
      user: `Create a mentor coaching brief and draft feedback.\n\n${JSON.stringify(userPayload)}`,
      temperature: 0.35,
    })) as Record<string, unknown>;

    const strengths = this.ensureStrengths(
      this.asStringArray(parsed.strengths, 4),
      evidence,
    );

    return {
      submissionId: evidence.submissionId,
      teamId: evidence.teamId,
      teamName: evidence.teamName,
      source: evidence.source,
      contextSummary: evidence.contextSummary,
      overview: this.asString(
        parsed.overview,
        "Snapshot unavailable — review submission links manually.",
      ),
      readiness: this.asReadiness(parsed.readiness, "needs_work"),
      strengths,
      risks: this.asStringArray(parsed.risks, 4),
      questionsToAsk: this.asStringArray(parsed.questionsToAsk, 5),
      focusNext: this.asString(
        parsed.focusNext,
        "Review submission and decide whether to meet the team.",
      ),
      draftFeedback: this.asString(
        parsed.draftFeedback,
        "Thanks for the submission. Please walk me through your demo, current blockers, and what you want feedback on before the next deadline.",
      ),
    };
  }

  async portfolioOverview(
    mentorId: number,
    eventId: number,
  ): Promise<MentorAiOverviewResult> {
    const cards = await this.buildTeamCards(mentorId, eventId);
    const stats = {
      totalTeams: cards.length,
      withSubmission: cards.filter((c) => c.latestSubmissionId).length,
      missingFeedback: cards.filter(
        (c) => c.latestSubmissionId && !c.hasFeedback,
      ).length,
      noSubmission: cards.filter((c) => !c.latestSubmissionId).length,
      highPriority: 0,
    };

    if (cards.length === 0) {
      return {
        summary: "No teams are assigned to you in this event yet.",
        stats,
        priorityTeams: [],
      };
    }

    const rulesRanked = this.rankCardsByRules(cards);
    let summary =
      "Prioritized by missing submissions, missing feedback, and unread chat. Generate AI overview for richer coaching hints.";
    let enriched = rulesRanked;

    try {
      const apiKey = this.submissionAi.requireOpenAiApiKey();
      const system = `You are a mentoring portfolio assistant for hackathon mentors managing many teams.
Given lightweight team cards (NOT full code), produce a quick triage overview.
Rules:
- Do NOT invent submission content or scores.
- Prefer teams with no submission, no mentor feedback, thin links, or unread chat as higher priority.
- Output JSON only:
  {
    "summary": string (2-3 sentences mentoring plan),
    "teams": [{
      "teamId": number,
      "priority": "high"|"medium"|"low",
      "reason": string,
      "focus": string,
      "readiness": "strong"|"needs_work"|"at_risk"|"no_submission"
    }]
  }
- Include every provided teamId exactly once.`;

      const parsed = (await this.submissionAi.requestJsonCompletion({
        apiKey,
        system,
        user: `Triage these assigned teams for a mentor.\n\n${JSON.stringify({
          eventId,
          teams: cards,
        })}`,
        temperature: 0.3,
        timeoutMs: 60_000,
      })) as {
        summary?: unknown;
        teams?: unknown;
      };

      summary = this.asString(parsed.summary, summary);
      const byId = new Map(
        (Array.isArray(parsed.teams) ? parsed.teams : [])
          .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
          .map((t) => [Number(t.teamId), t]),
      );

      enriched = rulesRanked.map((base) => {
        const ai = byId.get(base.teamId);
        if (!ai) return base;
        return {
          ...base,
          priority: this.asPriority(ai.priority, base.priority),
          reason: this.asString(ai.reason, base.reason),
          focus: this.asString(ai.focus, base.focus),
          readiness: this.asReadiness(ai.readiness, base.readiness),
        };
      });

      const order = { high: 0, medium: 1, low: 2 } as const;
      enriched.sort((a, b) => order[a.priority] - order[b.priority]);
    } catch {
      summary = `${summary} (Rules-based triage — AI unavailable or not configured.)`;
    }

    stats.highPriority = enriched.filter((t) => t.priority === "high").length;

    return {
      summary,
      stats,
      priorityTeams: enriched,
    };
  }

  private async ensureMentorCanAccessSubmission(
    mentorId: number,
    submissionId: number,
  ) {
    const submission = await this.prisma.submission.findFirst({
      where: {
        id: submissionId,
        team: { mentorAssignments: { some: { mentorId } } },
      },
      select: { id: true },
    });
    if (!submission) {
      throw new ForbiddenException(
        "You can only draft AI feedback for assigned teams.",
      );
    }
  }

  private async buildTeamCards(
    mentorId: number,
    eventId: number,
  ): Promise<TeamCard[]> {
    const teams = await this.prisma.team.findMany({
      where: {
        eventId,
        mentorAssignments: { some: { mentorId } },
      },
      select: {
        id: true,
        name: true,
        status: true,
        track: { select: { name: true } },
        teamRounds: {
          select: { status: true, round: { select: { name: true } } },
        },
        submissions: {
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: {
            id: true,
            description: true,
            fileUrl: true,
            githubUrl: true,
            round: { select: { name: true, submissionType: true } },
            mentorFeedbacks: {
              where: { mentorId },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true, status: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    if (teams.length === 0) {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true },
      });
      if (!event) throw new NotFoundException("Event not found");
      return [];
    }

    return Promise.all(
      teams.map(async (team) => {
        const latest = team.submissions[0] || null;
        const unreadChatCount = await this.prisma.teamMessage.count({
          where: {
            teamId: team.id,
            senderId: { not: mentorId },
            reads: { none: { userId: mentorId } },
          },
        });

        return {
          teamId: team.id,
          teamName: team.name,
          trackName: team.track?.name ?? null,
          teamStatus: team.status ?? null,
          latestSubmissionId: latest?.id ?? null,
          latestRoundName: latest?.round?.name ?? null,
          submissionType: latest?.round?.submissionType ?? null,
          hasFile: Boolean(latest?.fileUrl),
          hasGithub: Boolean(latest?.githubUrl),
          descriptionPreview: (latest?.description || "").slice(0, 280),
          hasFeedback: Boolean(latest?.mentorFeedbacks?.[0]),
          feedbackStatus: latest?.mentorFeedbacks?.[0]?.status ?? null,
          unreadChatCount,
          roundStatuses: team.teamRounds.map((tr) => tr.status),
        };
      }),
    );
  }

  private rankCardsByRules(cards: TeamCard[]): MentorAiOverviewTeam[] {
    const scored = cards.map((card) => {
      let score = 0;
      let readiness: MentorReadiness = "needs_work";
      const reasons: string[] = [];

      if (!card.latestSubmissionId) {
        score += 50;
        readiness = "no_submission";
        reasons.push("No submission yet");
      } else if (!card.hasFeedback) {
        score += 35;
        readiness = "at_risk";
        reasons.push("Submission waiting for mentor feedback");
      } else {
        readiness = "needs_work";
        reasons.push("Has submission and prior feedback");
      }

      if (card.latestSubmissionId && !card.hasFile && !card.hasGithub) {
        score += 20;
        readiness = readiness === "no_submission" ? readiness : "at_risk";
        reasons.push("Submission missing file/GitHub links");
      }

      if (card.unreadChatCount > 0) {
        score += Math.min(15, card.unreadChatCount * 3);
        reasons.push(`${card.unreadChatCount} unread chat message(s)`);
      }

      const priority: "high" | "medium" | "low" =
        score >= 40 ? "high" : score >= 20 ? "medium" : "low";

      const focus =
        readiness === "no_submission"
          ? "Nudge team to submit before deadline"
          : !card.hasFeedback
            ? "Open submission and send first feedback"
            : card.unreadChatCount > 0
              ? "Reply in team chat"
              : "Quick check-in on progress";

      return {
        teamId: card.teamId,
        teamName: card.teamName,
        trackName: card.trackName,
        priority,
        reason: reasons.join("; "),
        focus,
        readiness,
        latestSubmissionId: card.latestSubmissionId,
        latestRoundName: card.latestRoundName,
        hasFeedback: card.hasFeedback,
        unreadChatCount: card.unreadChatCount,
        _score: score,
      };
    });

    scored.sort((a, b) => b._score - a._score);
    return scored.map(({ _score, ...rest }) => rest);
  }

  private ensureStrengths(
    strengths: string[],
    evidence: {
      teamName: string;
      description: string | null;
      source: "file" | "github_link";
      fileUrl: string | null;
      githubUrl: string | null;
      contextSummary: string;
    },
  ): string[] {
    if (strengths.length > 0) return strengths;

    const fallback: string[] = [
      `${evidence.teamName} has an active submission ready for mentor review.`,
    ];

    if (evidence.description?.trim()) {
      fallback.push("Team provided submission notes/description for context.");
    }
    if (evidence.source === "github_link" || evidence.githubUrl) {
      fallback.push("Team shared a GitHub link as the submission entry point.");
    } else if (evidence.fileUrl) {
      fallback.push(
        "Team packaged a file submission (good first step — next improve readable docs/code inside).",
      );
    }
    if (/unreadable|no readable|empty|private/i.test(evidence.contextSummary)) {
      fallback.push(
        "Submission attempt is in — clarifying format will unlock deeper feedback.",
      );
    }

    return fallback.slice(0, 3);
  }

  private asString(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, 4000)
      : fallback;
  }

  private asStringArray(value: unknown, max: number): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((v): v is string => typeof v === "string" && !!v.trim())
      .map((v) => v.trim().slice(0, 400))
      .slice(0, max);
  }

  private asReadiness(
    value: unknown,
    fallback: MentorReadiness,
  ): MentorReadiness {
    const allowed: MentorReadiness[] = [
      "strong",
      "needs_work",
      "at_risk",
      "no_submission",
    ];
    return typeof value === "string" &&
      allowed.includes(value as MentorReadiness)
      ? (value as MentorReadiness)
      : fallback;
  }

  private asPriority(
    value: unknown,
    fallback: "high" | "medium" | "low",
  ): "high" | "medium" | "low" {
    return value === "high" || value === "medium" || value === "low"
      ? value
      : fallback;
  }
}
