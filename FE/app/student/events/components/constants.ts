import { Crown, Award, Activity, CheckCircle2, XCircle } from "lucide-react";

import { LucideIcon } from "lucide-react";

export type EventStatus =
    | "Champion"
    | "Finalist"
    | "Ongoing"
    | "Completed"
    | "Eliminated";

export interface EventItem {
    name: string;
    season: "Spring" | "Summer" | "Fall";
    year: number;
    status: EventStatus;
    category: string;
    rank: string;
    team: string;
    submission: string;
    progress: number;
}

export interface StatusMeta {
    color: string;
    icon: LucideIcon;
}

export const STATUS_META: Record<EventStatus, StatusMeta> = {
    Champion: {
        color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
        icon: Crown,
    },

    Finalist: {
        color: "bg-orange-500/15 text-orange-400 border-orange-500/30",
        icon: Award,
    },

    Ongoing: {
        color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        icon: Activity,
    },

    Completed: {
        color: "bg-muted text-zinc-400 border-border",
        icon: CheckCircle2,
    },

    Eliminated: {
        color: "bg-red-500/15 text-red-400 border-red-500/30",
        icon: XCircle,
    },
};

export const FILTERS = [
    "All",
    "Ongoing",
    "Completed",
    "Champion",
    "Finalist",
] as const;

export const events: EventItem[] = [
    {
        name: "SEAL Fall 2026 — Agile Frontier",
        season: "Fall",
        year: 2026,
        status: "Ongoing",
        category: "AI / ML",
        rank: "#7 of 142",
        team: "NebulaForge",
        submission: "Round 3 · pending review",
        progress: 68,
    },

    {
        name: "SEAL Summer 2026 — DevOps Arena",
        season: "Summer",
        year: 2026,
        status: "Finalist",
        category: "Cloud & DevOps",
        rank: "#4 of 120",
        team: "NebulaForge",
        submission: "Approved",
        progress: 100,
    },
];