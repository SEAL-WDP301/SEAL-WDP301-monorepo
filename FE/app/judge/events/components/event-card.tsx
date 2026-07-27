"use client";

import Link from "next/link";
import { ArrowRight, Layers, Users } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JudgeAssignedEvent } from "@/lib/api/judge.api";

interface EventCardProps {
  event: JudgeAssignedEvent;
}

export default function EventCard({ event }: EventCardProps) {
  const primaryRound = [...event.rounds].sort(
    (a, b) => a.roundNumber - b.roundNumber,
  )[0];

  const reviewHref = primaryRound
    ? `/judge/events/${event.id}/evalution?roundId=${primaryRound.roundId}`
    : `/judge/events/${event.id}/evalution`;

  return (
    <GlassCard className="overflow-hidden p-0 seal-card-hover bg-gradient-to-br">
      <div className="relative h-40 rounded-t-3xl bg-gradient-to-br from-orange-500/30 via-orange-500/10 to-transparent">
        <div className="seal-grid absolute inset-0 opacity-30" />

        <div className="absolute left-5 top-5 flex gap-2 flex-wrap">
          <Badge variant="outline" className="bg-background/50 border-border text-muted-foreground capitalize">
            {event.season} {event.year}
          </Badge>
          <Badge variant="outline" className="bg-background/50 border-border text-muted-foreground capitalize">
            {event.status}
          </Badge>
        </div>

        <div className="absolute bottom-5 left-5">
          <h3 className="text-2xl font-bold">{event.name}</h3>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card/40 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Layers className="h-4 w-4" />
              Rounds
            </div>
            <p className="text-xl font-bold">{event.rounds.length}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card/40 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-4 w-4" />
              Assignments
            </div>
            <p className="text-xl font-bold">{event.rounds.length}</p>
          </div>
        </div>

        {primaryRound && (
          <p className="text-sm text-muted-foreground">
            Next round: <span className="text-foreground">{primaryRound.roundName}</span>
            {primaryRound.trackName ? ` · ${primaryRound.trackName}` : ""}
          </p>
        )}

        <div className="mt-6 flex justify-start">
          <Link href={reviewHref}>
            <Button className="w-full bg-orange hover:bg-orange/90">
              Review
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
