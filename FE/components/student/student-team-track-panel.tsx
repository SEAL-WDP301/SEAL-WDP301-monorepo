"use client";

import { Brain, Code, Cpu, Layers, MapPin, Shield, Smartphone } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { StudentTrackDrawCard } from "@/components/student/student-track-draw-card";
import { isDeferredTrackEvent } from "@/lib/events/student-track-visibility";

type TrackDrawInfo = {
  studentSelfTrackDraw?: boolean;
  studentTrackDrawOpen?: boolean;
  canDrawTrack?: boolean;
};

type Props = {
  eventId: number;
  isLeader: boolean;
  teamTrackId?: number | null;
  teamTrackName?: string | null;
  teamTrackDescription?: string | null;
  event?: { deferredTrackAssignment?: boolean | null } | null;
  trackDraw?: TrackDrawInfo | null;
};

function resolveTrackIcon(trackName: string) {
  const key = trackName.trim().toLowerCase();
  if (/(ai|machine learning|ml|llm|nlp)/i.test(key)) return Brain;
  if (/(web|frontend|full.?stack)/i.test(key)) return Code;
  if (/(mobile|ios|android)/i.test(key)) return Smartphone;
  if (/(iot|hardware|embed)/i.test(key)) return Cpu;
  if (/(cyber|security|sec)/i.test(key)) return Shield;
  return Layers;
}

function AssignedTrackCard({
  trackName,
  trackDescription,
}: {
  trackName: string;
  trackDescription?: string | null;
}) {
  const Icon = resolveTrackIcon(trackName);
  const description = trackDescription?.trim();

  return (
    <GlassCard
      glow
      className="relative overflow-hidden rounded-[24px] border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-card to-background p-6 md:p-7"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-orange-500/15 blur-[70px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-48 rounded-full bg-[#F37021]/10 blur-[60px]" />

      <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F37021] to-[#fb923c] text-white shadow-lg shadow-orange-500/25">
            <Icon className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              Your team&apos;s competition track
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-orange-600 dark:text-orange-400 md:text-3xl">
              {trackName}
            </p>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        <Badge className="shrink-0 gap-1 self-start bg-orange-600/90 px-3 py-1 text-white hover:bg-orange-600">
          <MapPin className="h-3.5 w-3.5" />
          Track assigned
        </Badge>
      </div>
    </GlassCard>
  );
}

function WaitingBulkLotteryCard() {
  return (
    <GlassCard className="rounded-[24px] border-amber-500/30 bg-amber-500/5 p-6">
      <p className="font-semibold text-foreground">No track assigned</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Wait for the organizer to complete the Phase 2 draw.
      </p>
    </GlassCard>
  );
}

export function StudentTeamTrackPanel({
  eventId,
  isLeader,
  teamTrackId,
  teamTrackName,
  teamTrackDescription,
  event,
  trackDraw,
}: Props) {
  const trackLabel = teamTrackName?.trim();

  if (teamTrackId != null && trackLabel) {
    return (
      <AssignedTrackCard
        trackName={trackLabel}
        trackDescription={teamTrackDescription}
      />
    );
  }

  if (trackDraw?.studentSelfTrackDraw) {
    return (
      <StudentTrackDrawCard
        eventId={eventId}
        canDrawTrack={Boolean(trackDraw.canDrawTrack)}
        isLeader={isLeader}
        studentTrackDrawOpen={Boolean(trackDraw.studentTrackDrawOpen)}
      />
    );
  }

  if (isDeferredTrackEvent(event)) {
    return <WaitingBulkLotteryCard />;
  }

  return null;
}
