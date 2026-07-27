"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { JudgeRubric } from "@/lib/api/judge.api";

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
        No rubric available for this round/track. Organizer needs to configure scoring criteria first.
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {rubrics.map((item) => {
        const score = scores[item.id] ?? 0;
        const weight = Number(item.weight);

        return (
          <GlassCard key={item.id} className="p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xl font-semibold">{item.name}</h3>
                  <Badge variant="highlight">Weight {weight}</Badge>
                  <Badge variant="ai">Max {item.maxScore}</Badge>
                </div>
                {item.description && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>

              <div className="text-right shrink-0">
                <div className={`text-4xl font-bold ${disabled ? "text-muted-foreground opacity-60" : "text-orange-500"}`}>
                  {score.toFixed(1)}
                </div>
                <span className="text-xs text-muted-foreground">
                  /{item.maxScore}
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-4">
              <Slider
                value={[score]}
                max={item.maxScore}
                min={0}
                step={0.5}
                disabled={disabled}
                className="flex-1"
                onValueChange={(values) => onScoreChange(item.id, values[0] ?? 0)}
              />

              <Input
                type="number"
                min={0}
                max={item.maxScore}
                step={0.5}
                disabled={disabled}
                value={score}
                className="w-24 text-center"
                onChange={(e) =>
                  onScoreChange(item.id, Math.min(item.maxScore, Number(e.target.value) || 0))
                }
              />
            </div>

            <Textarea
              className="mt-4 min-h-[90px]"
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
