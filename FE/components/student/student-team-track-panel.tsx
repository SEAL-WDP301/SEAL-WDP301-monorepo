"use client";

import { MapPin } from "lucide-react";
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
  event?: { deferredTrackAssignment?: boolean | null } | null;
  trackDraw?: TrackDrawInfo | null;
};

function AssignedTrackCard({ trackName }: { trackName: string }) {
  return (
    <GlassCard className="rounded-[24px] border-emerald-500/40 bg-emerald-500/10 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Bảng thi của đội bạn</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{trackName}</p>
        </div>
        <Badge className="bg-emerald-600/90 text-white shrink-0 gap-1 px-3 py-1">
          <MapPin className="h-3.5 w-3.5" />
          Đã gán bảng
        </Badge>
      </div>
    </GlassCard>
  );
}

function WaitingBulkLotteryCard() {
  return (
    <GlassCard className="rounded-[24px] border-amber-500/30 bg-amber-500/5 p-6">
      <p className="font-semibold text-foreground">Chưa có bảng</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Chờ BTC bốc thăm Phase 2.
      </p>
    </GlassCard>
  );
}

export function StudentTeamTrackPanel({
  eventId,
  isLeader,
  teamTrackId,
  teamTrackName,
  event,
  trackDraw,
}: Props) {
  const trackLabel = teamTrackName?.trim();

  if (teamTrackId != null && trackLabel) {
    return <AssignedTrackCard trackName={trackLabel} />;
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
