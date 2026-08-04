"use client";

import { Clock } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import {
  getTrackPendingMessage,
  getTrackPendingTitle,
  isDeferredTrackEvent,
} from "@/lib/events/student-track-visibility";

type Props = {
  event?: { deferredTrackAssignment?: boolean | null } | null;
  className?: string;
};

export function TrackPendingBanner({ event, className }: Props) {
  const deferred = isDeferredTrackEvent(event);

  return (
    <GlassCard
      className={`p-5 rounded-[24px] border-amber-500/30 bg-amber-500/5 ${className ?? ""}`}
    >
      <div className="flex items-start gap-3 text-sm text-muted-foreground">
        <Clock className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
        <div>
          <p className="font-semibold text-foreground">{getTrackPendingTitle(deferred)}</p>
          <p className="mt-1">{getTrackPendingMessage(deferred)}</p>
        </div>
      </div>
    </GlassCard>
  );
}
