"use client";

import { Loader2, Send } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  computeLocalWeightedScore,
  getScoreColorClass,
  type JudgeRubric,
  type JudgeScoringStatus,
} from "@/lib/api/judge.api";

interface Props {
  rubrics: JudgeRubric[];
  scores: Record<number, number>;
  scoringStatus?: JudgeScoringStatus;
  weightedScore?: number | null;
  isSaving?: boolean;
  onSaveDraft?: () => void;
  onSubmit?: () => void;
  disabled?: boolean;
}

export function ScoreSummary({
  rubrics,
  scores,
  scoringStatus,
  isSaving,
  onSubmit,
  disabled,
}: Props) {
  const previewScore = computeLocalWeightedScore(rubrics, scores) ?? 0;
  const completedCriteria = rubrics.filter(
    (rubric) => scores[rubric.id] !== undefined,
  ).length;

  return (
    <GlassCard className="h-fit w-full p-5 sm:p-6 sticky top-4 mb-20">
      <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Final Score
      </div>

      <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
        <span className={cn("text-5xl font-black tabular-nums tracking-tight", getScoreColorClass(previewScore))}>
          {previewScore.toFixed(2)}
        </span>
        <span className="text-base font-bold text-muted-foreground">/ 10</span>
      </div>

      <div className="mt-1 text-xs font-semibold text-muted-foreground capitalize">
        Status: <span className="text-foreground font-bold">{scoringStatus?.replace("_", " ") ?? "pending"}</span>
      </div>

      <div className="mt-5 space-y-3">
        {rubrics.map((item) => {
          const score = scores[item.id] ?? 0;
          const weight = Number(item.weight);

          return (
            <div key={item.id} className="rounded-xl border border-border bg-background/40 p-3 shadow-2xs space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2">
                    {item.name}
                  </p>
                  <span className="text-[11px] font-medium text-muted-foreground mt-0.5 block">
                    Weight: <strong className="text-foreground/80">{weight}%</strong>
                  </span>
                </div>

                <div className="text-right shrink-0 ml-1">
                  <span className={cn("text-sm font-extrabold tabular-nums", getScoreColorClass(score))}>
                    {score % 1 === 0 ? score.toFixed(1) : score.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">/10</span>
                </div>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                <div
                  className={cn("h-full transition-all duration-300 rounded-full", getScoreColorClass(score).replace("text-", "bg-"))}
                  style={{
                    width: `${Math.min(100, (score / 10) * 100)}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pb-2">
        <Button
          className="w-full h-11 text-sm font-bold shadow-md rounded-xl"
          variant="orange"
          disabled={disabled || isSaving || completedCriteria === 0}
          onClick={onSubmit}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          ) : (
            <Send size={16} />
          )}
          Save scores
        </Button>
      </div>
    </GlassCard>
  );
}
