import { CalendarClock, ExternalLink, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

export type OnlineMeetingDetails = {
  platform?: string | null;
  meetUrl?: string | null;
  htmlLink?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  timeZone?: string | null;
};

export function isOnlineMeetingPublished(status?: string | null) {
  const normalizedStatus = status?.toLowerCase();
  return normalizedStatus === "ongoing";
}

function formatMeetingDateTime(
  value?: string | null,
  timeZone?: string | null,
) {
  if (!value) return "Not scheduled";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";

  try {
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }
}

export function OnlineMeetingCard({
  meeting,
  eventStatus,
  className,
}: {
  meeting?: OnlineMeetingDetails | null;
  eventStatus?: string | null;
  className?: string;
}) {
  if (!isOnlineMeetingPublished(eventStatus) || !meeting) return null;

  const meetingUrl = meeting.meetUrl || meeting.htmlLink;
  if (!meetingUrl && !meeting.startDate && !meeting.endDate) return null;

  return (
    <GlassCard
      className={cn(
        "rounded-[24px] border border-orange-500/20 bg-orange-500/[0.04] p-5",
        className,
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-orange-400" />
            <h2 className="font-semibold text-foreground">
              {meeting.platform || "Google Meet"}
            </h2>
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-background/40 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Meeting start
              </p>
              <p className="mt-1 font-medium text-foreground">
                {formatMeetingDateTime(meeting.startDate, meeting.timeZone)}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/40 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Meeting end
              </p>
              <p className="mt-1 font-medium text-foreground">
                {formatMeetingDateTime(meeting.endDate, meeting.timeZone)}
              </p>
            </div>
          </div>

          {meeting.timeZone ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              Time zone: {meeting.timeZone}
            </p>
          ) : null}
        </div>

        {meetingUrl ? (
          <Button asChild className="shrink-0 bg-orange-500 text-white hover:bg-orange-600">
            <a href={meetingUrl} target="_blank" rel="noreferrer">
              <Video className="h-4 w-4" />
              Join meeting
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        ) : null}
      </div>
    </GlassCard>
  );
}
