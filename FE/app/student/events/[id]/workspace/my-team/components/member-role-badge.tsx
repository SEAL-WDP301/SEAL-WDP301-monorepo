import { cn } from "@/lib/utils";

import type { MemberRole } from "../mock-data";

const roleStyles: Record<MemberRole, string> = {
    "TEAM LEADER": "border-orange-400/30 bg-gradient-to-r from-[#ff8a3d] to-[#f37021] text-black",
    "FRONTEND DEV": "border-sky-400/25 bg-sky-500/10 text-sky-300",
    "BACKEND DEV": "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
    PRESENTER: "border-purple-400/25 bg-purple-500/10 text-purple-300",
};

type MemberRoleBadgeProps = {
    role: MemberRole;
};

export function MemberRoleBadge({ role }: MemberRoleBadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[0.08em]",
                roleStyles[role]
            )}
        >
            {role}
        </span>
    );
}
