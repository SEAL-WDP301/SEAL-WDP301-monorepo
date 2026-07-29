"use client";

import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
    CalendarClock,
    Bell,
    ChevronLeft,
    ClipboardCheck,
    LayoutDashboard,
    User,
    Trophy,
} from "lucide-react";

import { cn } from "@/lib/utils";
import Logo from "@/components/ui/logo";

interface DashboardSidebarProps {
    collapsed: boolean;
    setCollapsed: (value: boolean) => void;
}

interface JudgeEventRound {
    status?: string;
    startDate?: string | null;
    endDate?: string | null;
}

interface JudgeEventSummary {
    rounds?: JudgeEventRound[];
}

const getMenus = (eventId: string, roundId?: string | null) => {
    const base = `/judge/events/${eventId}`;
    const query = roundId ? `?roundId=${roundId}` : "";
    return [
        {
            label: "Overview",
            href: `${base}/dashboard${query}`,
            basePath: `${base}/dashboard`,
            icon: LayoutDashboard,
        },
        {
            label: "Evalution",
            href: `${base}/evalution${query}`,
            basePath: `${base}/evalution`,
            icon: ClipboardCheck,
        },
        {
            label: "Leaderboard",
            href: `${base}/leaderboard${query}`,
            basePath: `${base}/leaderboard`,
            icon: Trophy,
        },
        {
            label: "Schedule",
            href: `${base}/schedule${query}`,
            basePath: `${base}/schedule`,
            icon: CalendarClock,
        },
        {
            label: "Profile",
            href: "/judge/profile",
            basePath: "/judge/profile",
            icon: User,
        },
    ];
};

import { useQuery } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";

export function JudgeSidebar({
    collapsed,
    setCollapsed,
}: DashboardSidebarProps) {
    const pathname = usePathname();
    const params = useParams();
    const searchParams = useSearchParams();
    const eventId = (params.eventId as string) || "1";

    const roundIdFromUrl = searchParams.get("roundId");
    const [savedRoundId, setSavedRoundId] = useState<string | null>(null);

    useEffect(() => {
        if (!eventId || typeof window === "undefined") return;
        if (roundIdFromUrl) {
            sessionStorage.setItem(`judge_round_${eventId}`, roundIdFromUrl);
            setSavedRoundId(roundIdFromUrl);
        } else {
            const stored = sessionStorage.getItem(`judge_round_${eventId}`);
            if (stored) {
                setSavedRoundId(stored);
            }
        }
    }, [eventId, roundIdFromUrl]);

    const activeRoundId = roundIdFromUrl || savedRoundId;
    const menus = getMenus(eventId, activeRoundId);

    const { data: event } = useQuery<JudgeEventSummary | null>({
        queryKey: ["judgeEvent", eventId],
        queryFn: async () => {
            const { data } = await axiosClient.get(`/public/events/${eventId}`);
            return data.data ?? null;
        },
        enabled: !!eventId,
    });

    const currentRound = event?.rounds?.find((round) => round.status === 'open' || round.status === 'not_started') || event?.rounds?.[0];
    const isRoundHasDates = !!(currentRound?.startDate || currentRound?.endDate);
    const shouldDisable = isRoundHasDates && currentRound?.status === 'not_started';

    return (
        <aside
            className={cn(
                "relative hidden border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-all duration-300 lg:flex lg:flex-col",
                collapsed ? "w-[92px]" : "w-[280px]"
            )}
        >
            {/* Logo */}
            <div
                className={cn(
                    "flex h-16 lg:h-20 items-center border-b border-sidebar-border transition-all duration-300",
                    collapsed
                        ? "justify-center px-4"
                        : "justify-start px-6"
                )}
            >
                <Logo collapsed={collapsed} />
            </div>

            {/* Navigation */}
            <div className="flex-1 p-4">
                <nav className="space-y-2">
                    {menus.map((item) => {
                        const Icon = item.icon;

                        const active = pathname === item.basePath;
                        const isDisabled = shouldDisable && item.label === 'Evalution';

                        const linkContent = (
                            <Link
                                key={item.href}
                                href={isDisabled ? "#" : item.href}
                                className={cn(
                                    "flex items-center rounded-2xl text-sm font-medium transition-all duration-300",
                                    collapsed
                                        ? "justify-center px-0 py-3"
                                        : "gap-3 px-4 py-3",
                                    active
                                        ? "bg-orange-500/15 text-orange-400 shadow-[0_0_30px_rgba(243,112,33,0.15)] ring-1 ring-orange-500/20"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                    isDisabled && "opacity-50 cursor-not-allowed pointer-events-none"
                                )}
                            >
                                <Icon className="h-5 w-5 shrink-0" />

                                <span
                                    className={cn(
                                        "whitespace-nowrap transition-all duration-200",
                                        collapsed
                                            ? "w-0 overflow-hidden opacity-0"
                                            : "w-auto opacity-100"
                                    )}
                                >
                                    {item.label}
                                </span>
                            </Link>
                        );

                        return isDisabled ? (
                            <div key={item.href} title="Round has not started yet">
                                {linkContent}
                            </div>
                        ) : linkContent;
                    })}
                </nav>
            </div>

            {/* Collapse Button */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-4 top-1/2 z-50 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-lg transition-all hover:scale-105"
            >
                <ChevronLeft
                    className={cn(
                        "h-4 w-4 transition-transform duration-300",
                        collapsed && "rotate-180"
                    )}
                />
            </button>
        </aside>
    );
}
