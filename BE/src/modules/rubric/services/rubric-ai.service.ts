import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { RUBRIC_WEIGHT_TOTAL } from "../../../common/utils/scoring.util";

export type SuggestedRubricCriterion = {
  name: string;
  description: string;
  weight: number;
  whyChosen: string;
};

export type SuggestRubricsResult = {
  basedOn: {
    eventName: string;
    roundName: string;
    tracks: Array<{ name: string; description: string | null }>;
    problemStatements: Array<{
      label: string;
      trackName: string | null;
      source: "shared" | "track";
    }>;
    existingCriteria: string[];
  };
  overallRationale: string;
  criteria: SuggestedRubricCriterion[];
};

@Injectable()
export class RubricAiService {
  private readonly logger = new Logger(RubricAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async suggestRubrics(
    eventId: number,
    roundId: number,
  ): Promise<SuggestRubricsResult> {
    const apiKey = this.requireOpenAiApiKey();

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        description: true,
        deferredTrackAssignment: true,
        tracks: {
          select: { id: true, name: true, description: true },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!event) throw new NotFoundException("Event not found");

    const round = await this.prisma.round.findFirst({
      where: { id: roundId, eventId },
      select: {
        id: true,
        name: true,
        roundNumber: true,
        isTrackSpecific: true,
        problemFileUrl: true,
        trackProblems: {
          select: {
            problemFileUrl: true,
            track: { select: { id: true, name: true, description: true } },
          },
        },
      },
    });
    if (!round) throw new NotFoundException("Round not found in this event");

    const existing = await this.prisma.criterion.findMany({
      where: { roundId },
      select: { name: true, weight: true },
      orderBy: { id: "asc" },
    });

    const problemStatements: SuggestRubricsResult["basedOn"]["problemStatements"] =
      [];

    if (round.problemFileUrl?.trim()) {
      problemStatements.push({
        label: this.labelFromUrl(round.problemFileUrl) || "Shared problem file",
        trackName: null,
        source: "shared",
      });
    }

    for (const tp of round.trackProblems) {
      if (!tp.problemFileUrl?.trim()) continue;
      problemStatements.push({
        label:
          this.labelFromUrl(tp.problemFileUrl) ||
          `Problem for ${tp.track.name}`,
        trackName: tp.track.name,
        source: "track",
      });
    }

    // Track-specific rounds use only tracks scoped into THIS round.
    const scopedTracks = round.isTrackSpecific
      ? round.trackProblems.map((tp) => tp.track)
      : event.tracks;

    if (!scopedTracks.length && !problemStatements.length) {
      throw new BadRequestException(
        "Add at least one track or upload a problem file before AI can suggest rubrics.",
      );
    }

    const basedOn: SuggestRubricsResult["basedOn"] = {
      eventName: event.name,
      roundName: `Round ${round.roundNumber}: ${round.name}`,
      tracks: scopedTracks.map((t) => ({
        name: t.name,
        description: t.description,
      })),
      problemStatements,
      existingCriteria: existing.map((c) => c.name),
    };

    const system = `You design hackathon judging rubrics. Return ONLY JSON:
{
  "overallRationale": string,
  "criteria": [
    { "name": string, "description": string, "weight": number, "whyChosen": string }
  ]
}
Rules:
- 4–7 criteria for ONE round rubric shared by all tracks in that round.
- Weights are % and MUST sum to 100 (1 decimal max).
- Avoid duplicating existingCriteria names.
- Ground criteria in event name, this round, track names, and problem titles; cite them in whyChosen.
- English only. Keep overallRationale and whyChosen concise (1–2 sentences each).
- overallRationale MUST start by naming the event and listing track themes, e.g. "Based on the event \"X\" and track themes (A, B), here are suggested grading criteria:" then briefly explain the rubric design.`;

    const user = `Design grading criteria for this hackathon round.

Event: ${basedOn.eventName}
Event blurb: ${(event.description || "").slice(0, 800) || "(none)"}
Round: ${basedOn.roundName}
Track-specific problems: ${round.isTrackSpecific ? "yes" : "no / shared"}

Tracks:
${
  basedOn.tracks.length
    ? basedOn.tracks
        .map(
          (t, i) =>
            `${i + 1}. ${t.name}${t.description ? ` — ${t.description}` : ""}`,
        )
        .join("\n")
    : "(no tracks yet)"
}

Problem statement titles (đề):
${
  basedOn.problemStatements.length
    ? basedOn.problemStatements
        .map(
          (p) =>
            `- ${p.label}${p.trackName ? ` (track: ${p.trackName})` : " (shared)"}`,
        )
        .join("\n")
    : "(no problem files uploaded yet — infer from track/event names only)"
}

Existing criteria to avoid duplicating:
${
  basedOn.existingCriteria.length
    ? basedOn.existingCriteria.map((n) => `- ${n}`).join("\n")
    : "(none)"
}

Return JSON now.`;

    const raw = await this.requestJsonCompletion({
      apiKey,
      system,
      user,
      temperature: 0.35,
      timeoutMs: 90_000,
    });

    const criteria = this.normalizeCriteria(raw);
    const overallRationale =
      typeof (raw as { overallRationale?: unknown })?.overallRationale ===
      "string"
        ? String((raw as { overallRationale: string }).overallRationale).trim()
        : this.buildFallbackRationale(basedOn);

    return {
      basedOn,
      overallRationale,
      criteria,
    };
  }

  private normalizeCriteria(raw: unknown): SuggestedRubricCriterion[] {
    const list = (raw as { criteria?: unknown })?.criteria;
    if (!Array.isArray(list) || list.length === 0) {
      throw new ServiceUnavailableException(
        "AI returned no criteria. Try again.",
      );
    }

    const parsed: SuggestedRubricCriterion[] = [];
    for (const item of list) {
      const row = item as Record<string, unknown>;
      const name = String(row.name || "").trim();
      const description = String(row.description || "").trim();
      const whyChosen = String(row.whyChosen || row.reason || "").trim();
      const weight = Number(row.weight);
      if (!name || !Number.isFinite(weight) || weight <= 0) continue;
      parsed.push({
        name: name.slice(0, 120),
        description: description.slice(0, 2000) || name,
        weight,
        whyChosen:
          whyChosen.slice(0, 1000) ||
          "Chosen to cover a core judging dimension for this round.",
      });
    }

    if (parsed.length < 3) {
      throw new ServiceUnavailableException(
        "AI returned too few valid criteria. Try again.",
      );
    }

    // Normalize weights to exactly 100%.
    const sum = parsed.reduce((s, c) => s + c.weight, 0);
    if (sum <= 0) {
      throw new ServiceUnavailableException("AI returned invalid weights.");
    }

    const scaled = parsed.map((c) => ({
      ...c,
      weight: Math.round((c.weight / sum) * RUBRIC_WEIGHT_TOTAL * 10) / 10,
    }));

    const scaledSum = scaled.reduce((s, c) => s + c.weight, 0);
    const drift = Math.round((RUBRIC_WEIGHT_TOTAL - scaledSum) * 10) / 10;
    if (scaled.length && Math.abs(drift) >= 0.1) {
      scaled[scaled.length - 1].weight =
        Math.round((scaled[scaled.length - 1].weight + drift) * 10) / 10;
    }

    return scaled;
  }

  private buildFallbackRationale(
    basedOn: SuggestRubricsResult["basedOn"],
  ): string {
    const trackNames = basedOn.tracks.map((t) => t.name).filter(Boolean);
    const trackPart =
      trackNames.length > 0
        ? ` and track themes (${trackNames.join(", ")})`
        : "";
    return `Based on the event "${basedOn.eventName}"${trackPart}, here are suggested grading criteria for ${basedOn.roundName}.`;
  }

  private labelFromUrl(url: string): string | null {
    try {
      const path = new URL(url).pathname;
      const base = decodeURIComponent(path.split("/").pop() || "");
      if (!base) return null;
      return base.replace(/\.[^.]+$/, "") || base;
    } catch {
      const base = url.split("?")[0].split("/").pop() || "";
      if (!base) return null;
      try {
        return decodeURIComponent(base).replace(/\.[^.]+$/, "") || base;
      } catch {
        return base;
      }
    }
  }

  private requireOpenAiApiKey(): string {
    const apiKey = this.configService.get<string>("ai.openaiApiKey") || "";
    if (!apiKey.trim()) {
      throw new ServiceUnavailableException(
        "AI assist is not configured. Set OPENAI_API_KEY on the server.",
      );
    }
    return apiKey;
  }

  private async requestJsonCompletion(input: {
    apiKey: string;
    system: string;
    user: string;
    temperature?: number;
    timeoutMs?: number;
  }): Promise<unknown> {
    const model =
      this.configService.get<string>("ai.openaiModel") || "gpt-4o-mini";
    const baseUrl =
      this.configService.get<string>("ai.openaiBaseUrl") ||
      "https://api.openai.com/v1";

    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: input.temperature ?? 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
        }),
        signal: AbortSignal.timeout(input.timeoutMs ?? 90_000),
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      this.logger.error(
        `OpenAI error ${response.status}: ${errText.slice(0, 500)}`,
      );
      throw new ServiceUnavailableException(
        `AI provider error (${response.status}). Check OPENAI_API_KEY / quota.`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new ServiceUnavailableException("AI returned an empty response.");
    }

    try {
      return JSON.parse(content);
    } catch {
      throw new ServiceUnavailableException("AI returned invalid JSON.");
    }
  }
}
