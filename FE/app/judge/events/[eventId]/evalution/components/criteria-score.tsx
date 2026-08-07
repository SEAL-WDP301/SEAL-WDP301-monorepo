"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  JUDGE_SCORE_SCALE,
  getScoreColorClass,
  type JudgeRubric,
} from "@/lib/api/judge.api";

interface Props {
  rubrics: JudgeRubric[];
  scores: Record<number, number>;
  comments: Record<number, string>;
  onScoreChange: (criterionId: number, value: number) => void;
  onCommentChange: (criterionId: number, value: string) => void;
  disabled?: boolean;
}

export function CriteriaScoring({
  rubrics,
  scores,
  comments,
  onScoreChange,
  onCommentChange,
  disabled,
}: Props) {
  if (!rubrics.length) {
    return (
      <GlassCard className="p-8 text-sm text-muted-foreground">
        No rubric configured yet. Ask the organizer to add grading criteria.
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3 w-full">
      {rubrics.map((item) => {
        const score = scores[item.id] ?? 0;
        const weight = Number(item.weight);

        return (
          <GlassCard key={item.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold truncate">{item.name}</h3>
                  <Badge variant="highlight" className="shrink-0 text-[10px] px-1.5 py-0">
                    {weight}%
                  </Badge>
                </div>
                {item.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>

              <div className="text-right shrink-0">
                <div className={cn("text-3xl font-bold leading-none tabular-nums", disabled ? "text-muted-foreground opacity-60" : getScoreColorClass(score))}>
                  {score % 1 === 0 ? score.toFixed(1) : score.toFixed(2)}
                </div>
                <span className="text-xs text-muted-foreground">
                  /{JUDGE_SCORE_SCALE}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Slider
                value={[score]}
                max={JUDGE_SCORE_SCALE}
                min={0}
                step={0.25}
                disabled={disabled}
                className="flex-1"
                onValueChange={(values) => onScoreChange(item.id, values[0] ?? 0)}
              />

              <Input
                type="number"
                min={0}
                max={JUDGE_SCORE_SCALE}
                step={0.25}
                disabled={disabled}
                value={score}
                className="w-20 text-center h-9"
                onChange={(e) =>
                  onScoreChange(
                    item.id,
                    Math.min(JUDGE_SCORE_SCALE, Number(e.target.value) || 0),
                  )
                }
              />
            </div>

            <Textarea
              className="mt-3 min-h-[70px] text-sm"
              disabled={disabled}
              placeholder="Comment on this criterion..."
              value={comments[item.id] ?? ""}
              onChange={(e) => onCommentChange(item.id, e.target.value)}
            />
          </GlassCard>
        );
      })}
    </div>
  );
}
