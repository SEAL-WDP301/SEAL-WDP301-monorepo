"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { Textarea } from "@/components/ui/textarea";

interface JudgeCommentsCardProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function JudgeCommentsCard({
  value,
  onChange,
  disabled,
}: JudgeCommentsCardProps) {
  return (
    <GlassCard className="p-6 space-y-4">
      <div>
        <h3 className="text-xl font-semibold">Overall Comments</h3>
        <p className="text-sm text-muted-foreground mt-1">
          General overview notes for the team (attached to the score when saved)
        </p>
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Overall feedback, strengths/weaknesses, suggestions for improvement..."
        className="min-h-[140px] bg-background/60"
      />
    </GlassCard>
  );
}
