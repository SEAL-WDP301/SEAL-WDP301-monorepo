"use client";

import { ArrowUpRight, Calendar } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";


import { EventProgress } from "./event-progress";
import { EventItem, STATUS_META } from "./constants";

interface EventCardProps {
    event: EventItem;
}

export function EventCard({
    event,
}: EventCardProps) {
    const meta = STATUS_META[event.status];
    const Icon = meta.icon;

    return (
        <div className="overflow-hidden rounded-3xl border border-border bg-[#140b07] backdrop-blur-xl transition-all duration-300 hover:border-orange-500/30">
            <div className="relative h-36 overflow-hidden border-b border-border">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-transparent to-transparent" />

                <div className="absolute left-5 right-5 top-4 flex items-center justify-between">
                    <div className="flex items-center gap-1 rounded-full border border-border bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-300">
                        <Calendar className="h-3 w-3 text-orange-400" />
                        {event.season} {event.year}
                    </div>

                    <div
                        className={cn(
                            "flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em]",
                            meta.color
                        )}
                    >
                        <Icon className="h-3 w-3" />
                        {event.status}
                    </div>
                </div>

                <div className="absolute bottom-5 left-5 right-5">
                    <p className="text-[11px] uppercase tracking-[0.25em] text-orange-400">
                        {event.category}
                    </p>

                    <h3 className="mt-2 text-lg font-bold text-foreground">
                        {event.name}
                    </h3>
                </div>
            </div>

            <div className="p-5">
                <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                            Rank
                        </p>

                        <p className="mt-1 font-bold text-orange-400">
                            {event.rank}
                        </p>
                    </div>

                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                            Team
                        </p>

                        <p className="mt-1 truncate font-medium text-foreground">
                            {event.team}
                        </p>
                    </div>

                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                            Submission
                        </p>

                        <p className="mt-1 truncate font-medium text-foreground">
                            {event.submission}
                        </p>
                    </div>
                </div>

                <EventProgress progress={event.progress} />

                <div className="mt-5 flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                    >
                        <Link href="/student/events/1">
                            View Detail
                            <ArrowUpRight className="h-3 w-3" />
                        </Link>
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                    >
                        <Link href="/student/submission">
                            Submission
                        </Link>
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                    >
                        <Link href="/student/ranking">
                            Ranking
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}