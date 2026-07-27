import { cn } from "@/lib/utils";

import type { MemberStatus } from "../mock-data";

const statusStyles: Record<MemberStatus, string> = {
    Active: "border-orange-500/25 bg-orange-500/10 text-orange-300",
    Pending: "border-yellow-500/25 bg-yellow-500/10 text-yellow-300",
    Offline: "border-border bg-white/[0.035] text-muted-foreground",
};

type MemberStatusBadgeProps = {
    status: MemberStatus;
};

export function MemberStatusBadge({ status }: MemberStatusBadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                statusStyles[status]
            )}
        >
            <span
                className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    status === "Active" && "bg-orange-400",
                    status === "Pending" && "bg-yellow-300",
                    status === "Offline" && "bg-white/30"
                )}
            />
            {status}
        </span>
    );
}
