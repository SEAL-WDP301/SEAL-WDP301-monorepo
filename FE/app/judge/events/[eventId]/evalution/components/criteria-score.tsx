"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  JUDGE_SCORE_SCALE,
  JUDGE_SCORE_STEP,
  getScoreColorClass,
  type JudgeRubric,
} from "@/lib/api/judge.api";

function clampScore(value: number, snapToStep = false) {
  if (!Number.isFinite(value)) return 0;
  const bounded = Math.min(JUDGE_SCORE_SCALE, Math.max(0, value));
  if (!snapToStep) return Number(bounded.toFixed(2));
  const stepped =
    Math.round(bounded / JUDGE_SCORE_STEP) * JUDGE_SCORE_STEP;
  return Number(stepped.toFixed(2));
}

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
          <GlassCard key={item.id} className="overflow-visible px-5 py-4">
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
                <div
                  className={cn(
                    "text-3xl font-bold leading-none tabular-nums",
                    disabled
                      ? "text-muted-foreground opacity-60"
                      : getScoreColorClass(score),
                  )}
                >
                  {score.toFixed(2)}
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
                step={JUDGE_SCORE_STEP}
                disabled={disabled}
                className="flex-1"
                onValueChange={(values) =>
                  onScoreChange(item.id, clampScore(values[0] ?? 0, true))
                }
              />

              <Input
                type="number"
                min={0}
                max={JUDGE_SCORE_SCALE}
                step={JUDGE_SCORE_STEP}
                disabled={disabled}
                value={Number(score.toFixed(2))}
                className="w-24 text-center h-9"
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "" || raw === ".") return;
                  onScoreChange(item.id, clampScore(Number(raw)));
                }}
                onBlur={(e) => {
                  onScoreChange(
                    item.id,
                    clampScore(Number(e.target.value), true),
                  );
                }}
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
