"use client";

import { Loader2, Send } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import {
  computeLocalWeightedScore,
  JUDGE_SCORE_SCALE,
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
  const progress = rubrics.length
    ? Math.round((completedCriteria / rubrics.length) * 100)
    : 0;

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

      <div className="mt-5 rounded-xl border border-border bg-background/40 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Criteria completed</span>
          <span className="text-orange-400">
            {completedCriteria}/{rubrics.length}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-orange-500 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {rubrics.map((item) => {
          const score = scores[item.id] ?? 0;
          const weight = Number(item.weight);
          const contribution = (score / JUDGE_SCORE_SCALE) * weight;

          return (
            <div key={item.id}>
              <div className="mb-1 flex justify-between text-sm">
                <span>
                  {item.name}{" "}
                  <span className="text-muted-foreground">({weight})</span>
                </span>
                <span>{contribution.toFixed(2)}</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full bg-orange-500"
                  style={{
                    width: `${Math.min(100, (score / JUDGE_SCORE_SCALE) * 100)}%`,
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
