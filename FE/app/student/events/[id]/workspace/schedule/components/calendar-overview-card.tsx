import { CalendarDays } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

import type { CalendarDay } from "../mock-data";

type CalendarOverviewCardProps = {
    days: CalendarDay[];
};

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarOverviewCard({ days }: CalendarOverviewCardProps) {
    return (
        <GlassCard glow className="rounded-[24px] bg-card p-6 hover:-translate-y-1">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-foreground">
                        May 2026
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Submission deadlines, mentor meetings, workshops, and review sessions.
                    </p>
                </div>
                <Badge variant="warning">
                    Deadline week
                </Badge>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center">
                {weekDays.map((day) => (
                    <div key={day} className="pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {day}
                    </div>
                ))}

                {days.map((day, index) => (
                    <div
                        key={`${day.day}-${index}`}
                        className={cn(
                            "group min-h-24 rounded-[18px] border border-border bg-white/[0.025] p-3 text-left transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/30 hover:bg-orange-500/5",
                            day.muted && "opacity-35",
                            day.today && "border-orange-500/35 bg-orange-500/10 shadow-[0_0_30px_rgba(243,112,33,0.12)]",
                            day.urgent && "border-red-500/30 bg-red-500/10"
                        )}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className={cn("text-sm font-semibold", day.today || day.urgent ? "text-foreground" : "text-muted-foreground")}>
                                {day.day}
                            </span>
                            {day.today ? <CalendarDays className="h-4 w-4 text-orange-300" /> : null}
                        </div>

                        <div className="mt-3 space-y-1">
                            {day.events?.slice(0, 2).map((event) => (
                                <div
                                    key={event}
                                    className={cn(
                                        "truncate rounded-full border px-2 py-1 text-[10px] font-semibold",
                                        day.urgent
                                            ? "border-red-400/25 bg-red-500/10 text-red-200"
                                            : "border-orange-500/20 bg-orange-500/10 text-orange-200"
                                    )}
                                >
                                    {event}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}
