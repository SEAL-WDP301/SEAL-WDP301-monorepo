import { cn } from "@/lib/utils";

import type { SubmissionStatus } from "../mock-data";

const statusStyles: Record<SubmissionStatus, string> = {
    Draft: "border-border bg-white/[0.035] text-muted-foreground",
    Submitted: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    Reviewed: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    "Need Revision": "border-red-500/30 bg-red-500/10 text-red-300",
    Accepted: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

type SubmissionStatusBadgeProps = {
    status: SubmissionStatus;
};

export function SubmissionStatusBadge({ status }: SubmissionStatusBadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                statusStyles[status]
            )}
        >
            {status}
        </span>
    );
}
