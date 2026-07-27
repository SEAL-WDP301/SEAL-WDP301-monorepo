import { cn } from "@/lib/utils";

import type { ScheduleStatus } from "../mock-data";

const statusStyles: Record<ScheduleStatus, string> = {
    Upcoming: "border-sky-500/25 bg-sky-500/10 text-sky-300",
    Ongoing: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    Completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    Missed: "border-border bg-white/[0.035] text-muted-foreground",
    Urgent: "border-red-500/30 bg-red-500/10 text-red-300",
};

type ScheduleStatusBadgeProps = {
    status: ScheduleStatus;
};

export function ScheduleStatusBadge({ status }: ScheduleStatusBadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                statusStyles[status]
            )}
        >
            {status}
        </span>
    );
}
