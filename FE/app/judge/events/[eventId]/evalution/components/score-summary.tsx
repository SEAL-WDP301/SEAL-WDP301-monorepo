"use client";

import { Loader2, Send } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import {
  computeLocalWeightedScore,
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
    <GlassCard className="h-fit w-full p-8 sticky top-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">
        Final Score
      </div>

      <div className="mt-2 text-5xl font-bold text-primary">
        <span className="text-7xl font-black text-orange-500">
          {previewScore.toFixed(2)}
        </span>
        <span className="pb-3 text-xl text-muted-foreground">/10</span>
      </div>

      <div className="mt-2 text-sm text-muted-foreground capitalize">
        Status: {scoringStatus?.replace("_", " ") ?? "pending"}
      </div>

      <div className="mt-4 space-y-3">
        {rubrics.map((item) => {
          const score = scores[item.id] ?? 0;
          const weight = Number(item.weight);

          return (
            <div key={item.id} className="rounded-xl border border-border bg-background/30 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground/80 leading-tight">
                  {item.name}
                  <span className="ml-1 text-muted-foreground">({weight}%)</span>
                </span>
                <div className="text-right shrink-0 ml-2">
                  <span className="text-sm font-bold text-orange-400">
                    {score.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">/10</span>
                </div>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full bg-orange-500 transition-[width]"
                  style={{
                    width: `${Math.min(100, (score / 10) * 100)}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <Button
          className="w-full"
          disabled={disabled || isSaving || completedCriteria === 0}
          onClick={onSubmit}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send size={16} />
          )}
          Save scores
        </Button>
      </div>
    </GlassCard>
  );
}
