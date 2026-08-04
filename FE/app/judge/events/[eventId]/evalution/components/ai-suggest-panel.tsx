"use client";

import { Loader2, Sparkles, Info } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import type {
  AiSuggestScoresResult,
  JudgeRubric,
} from "@/lib/api/judge.api";

interface Props {
  rubrics: JudgeRubric[];
  suggestion: AiSuggestScoresResult | null;
  isSuggesting?: boolean;
  disabled?: boolean;
  onSuggest?: () => void;
}

export function AiSuggestPanel({
  rubrics,
  suggestion,
  isSuggesting,
  disabled,
  onSuggest,
}: Props) {
  const rubricById = new Map(rubrics.map((r) => [r.id, r]));
  const sourceLabel =
    suggestion?.source === "github_link"
      ? "GitHub"
      : suggestion?.source === "file"
        ? "File"
        : null;

  return (
    <GlassCard className="p-6 space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            <h3 className="text-xl font-semibold">AI Scoring Assist</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate suggested scores and comments from the submission using this
            round&apos;s rubrics. Suggestions are applied to the score form
            immediately — review and save when ready.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={disabled || isSuggesting || !onSuggest}
          onClick={onSuggest}
        >
          {isSuggesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {suggestion ? "Regenerate" : "AI Suggest"}
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 text-sm text-orange-100">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
        <div className="space-y-1">
          <p className="font-medium text-orange-300">
            AI assist only — judge is final
          </p>
          <p className="text-xs leading-relaxed text-orange-100/80">
            Suggestions follow the event rubric. AI does not replace human
            judging, does not auto-save scores, and may miss evidence when a
            repo or file cannot be fully read. Always review before Save.
          </p>
        </div>
      </div>

      {isSuggesting && (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-background/40 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
          Reading submission and applying suggested scores…
        </div>
      )}

      {suggestion && !isSuggesting && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {sourceLabel && (
              <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 font-bold uppercase tracking-wider text-orange-500">
                {sourceLabel}
              </span>
            )}
            <span>{suggestion.contextSummary}</span>
            <span className="opacity-70">· audit #{suggestion.auditId}</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-[1.4fr_0.7fr_2fr] gap-3 border-b border-white/10 bg-background/50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Criterion</span>
              <span>Suggested score</span>
              <span>Rationale</span>
            </div>
            <div className="divide-y divide-white/10">
              {suggestion.suggestions.map((item) => {
                const rubric = rubricById.get(item.criterionId);
                return (
                  <div
                    key={item.criterionId}
                    className="grid grid-cols-[1.4fr_0.7fr_2fr] gap-3 px-4 py-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">
                        {rubric?.name ?? `Criterion #${item.criterionId}`}
                      </div>
                      {rubric && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          weight {rubric.weight}%
                          {rubric.description
                            ? ` · ${rubric.description}`
                            : ""}
                        </div>
                      )}
                    </div>
                    <div className="font-semibold text-orange-500">
                      {item.scoreValue}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        / 10
                      </span>
                    </div>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {item.comment || "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
