"use client";

import React from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { ChevronRight } from "lucide-react";
import type { JudgeAssignedRound } from "@/lib/api/judge.api";

interface RoundTabsProps {
  rounds: JudgeAssignedRound[];
  selectedRoundId: number | null;
  onSelectRound: (roundId: number) => void;
}

export function RoundTabs({
  rounds,
  selectedRoundId,
  onSelectRound,
}: RoundTabsProps) {
  if (!rounds.length) {
    return (
      <GlassCard className="p-4 text-sm text-muted-foreground">
        No rounds assigned for this event.
      </GlassCard>
    );
  }

  const sorted = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  const uniqueSorted = Array.from(new Map(sorted.map(r => [r.roundId, r])).values());

  return (
    <div className="flex flex-nowrap items-center gap-2">
      {uniqueSorted.map((round, index) => {
        const active = round.roundId === selectedRoundId;
        return (
          <React.Fragment key={round.roundId}>
            <button
              type="button"
              onClick={() => onSelectRound(round.roundId)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {round.roundName}
            </button>
            {index < uniqueSorted.length - 1 && (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
