"use client";

import { Loader2, Sparkles, Check, X, Info } from "lucide-react";
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
  isApplying?: boolean;
  disabled?: boolean;
  onSuggest?: () => void;
  onApply?: () => void;
  onDismiss?: () => void;
}

export function AiSuggestPanel({
  rubrics,
  suggestion,
  isSuggesting,
  isApplying,
  disabled,
  onSuggest,
  onApply,
  onDismiss,
}: Props) {
  const rubricById = new Map(rubrics.map((r) => [r.id, r]));
  const sourceLabel =
    suggestion?.source === "github_link"
      ? "GitHub"
      : suggestion?.source === "file"
        ? "File"
        : null;
  const busy = Boolean(isSuggesting || isApplying);

  return (
    <GlassCard className="p-6 space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            <h3 className="text-xl font-semibold">AI Scoring Assist</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate suggested scores and reasons from the submission using this
            round&apos;s official rubrics. Review first — nothing is applied
            until you click Apply.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={disabled || busy || !onSuggest}
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
            Suggestions follow the event rubric criteria for this round. AI does
            not replace human judging, does not auto-save scores, and may miss
            evidence when a repo/file cannot be fully read. Always review before
            Apply and Save.
          </p>
        </div>
      </div>

      {isSuggesting && !suggestion && (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-background/40 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
          Reading submission and drafting suggestions against the round rubrics…
        </div>
      )}

      {suggestion && (
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
              <span>Tiêu chí (rubric)</span>
              <span>Điểm suggest</span>
              <span>Lý do</span>
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
                          share {rubric.weight}/10
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

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled={disabled || busy}
              onClick={onDismiss}
            >
              <X size={16} />
              Discard
            </Button>
            <Button
              type="button"
              disabled={disabled || busy || !onApply}
              onClick={onApply}
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Apply to scores
            </Button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
