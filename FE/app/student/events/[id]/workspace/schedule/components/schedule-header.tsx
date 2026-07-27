import { BellPlus, CalendarClock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { ScheduleMeta } from "../mock-data";

type ScheduleHeaderProps = {
    meta: ScheduleMeta;
};

export function ScheduleHeader({ meta }: ScheduleHeaderProps) {
    return (
        <header className="border-b border-border pb-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-400">
                        Team Workspace
                    </p>
                    <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
                        Schedule
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Track your hackathon timeline and upcoming activities
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-2">
                            <CalendarClock className="h-4 w-4 text-orange-400" />
                            {meta.currentDate}
                        </span>
                        <span>{meta.timezone}</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Badge>
                        {meta.currentRound}
                    </Badge>
                    <Button variant="orange" className="rounded-2xl px-5">
                        <BellPlus className="h-4 w-4" />
                        Add Reminder
                    </Button>
                </div>
            </div>
        </header>
    );
}
