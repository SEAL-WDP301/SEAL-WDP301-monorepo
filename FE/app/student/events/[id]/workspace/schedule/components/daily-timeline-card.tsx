import { Clock3 } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";

import type { TimelineItem } from "../mock-data";
import { ScheduleStatusBadge } from "./schedule-status-badge";

type DailyTimelineCardProps = {
    items: TimelineItem[];
};

export function DailyTimelineCard({ items }: DailyTimelineCardProps) {
    return (
        <GlassCard className="rounded-[24px] bg-card p-6 hover:-translate-y-1">
            <div className="mb-6 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-400">
                    <Clock3 className="h-4 w-4" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        Today&apos;s Timeline
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Fast agenda for team coordination.
                    </p>
                </div>
            </div>

            <div className="space-y-5">
                {items.map((item, index) => (
                    <div key={`${item.time}-${item.title}`} className="relative flex gap-4">
                        {index < items.length - 1 ? (
                            <span className="absolute left-[67px] top-8 h-[calc(100%_+_0.25rem)] w-px bg-white/10" />
                        ) : null}
                        <div className="w-14 shrink-0 pt-1 text-right text-sm font-semibold text-orange-300">
                            {item.time}
                        </div>
                        <span className="mt-2 h-3 w-3 shrink-0 rounded-full bg-orange-500 shadow-[0_0_16px_rgba(243,112,33,0.7)]" />
                        <div className="flex-1 rounded-[20px] border border-border bg-white/[0.035] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="font-semibold text-foreground">
                                    {item.title}
                                </p>
                                <ScheduleStatusBadge status={item.status} />
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {item.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}
