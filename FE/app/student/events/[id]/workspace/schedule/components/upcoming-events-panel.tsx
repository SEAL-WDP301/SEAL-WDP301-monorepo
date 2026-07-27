import { AlertTriangle, CalendarClock } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

import type { UpcomingEvent } from "../mock-data";
import { ScheduleStatusBadge } from "./schedule-status-badge";

type UpcomingEventsPanelProps = {
    events: UpcomingEvent[];
};

export function UpcomingEventsPanel({ events }: UpcomingEventsPanelProps) {
    return (
        <GlassCard className="rounded-[24px] bg-card p-6 hover:-translate-y-1">
            <div className="mb-5">
                <h2 className="text-lg font-semibold text-foreground">
                    Upcoming Events
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Next 5 activities for your team.
                </p>
            </div>

            <div className="space-y-3">
                {events.map((event) => {
                    const urgent = event.status === "Urgent";

                    return (
                        <div
                            key={`${event.title}-${event.time}`}
                            className={cn(
                                "rounded-[20px] border bg-white/[0.035] p-4",
                                urgent ? "border-red-500/25 border-l-red-500" : "border-border border-l-orange-500/50",
                                "border-l-2"
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", urgent ? "bg-red-500/10 text-red-300" : "bg-orange-500/10 text-orange-400")}>
                                    {urgent ? <AlertTriangle className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="font-semibold text-foreground">
                                            {event.title}
                                        </p>
                                        <ScheduleStatusBadge status={event.status} />
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {event.time}
                                    </p>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        Priority: {event.priority}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </GlassCard>
    );
}
