"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Clock, Loader2, Trophy } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { workspaceApi } from "@/lib/api/workspace.api";

type WorkspaceRound = {
    id: number;
    roundNumber?: number;
    name?: string;
    status?: string;
    startDate?: string | null;
    submissionDeadline?: string | null;
    endDate?: string | null;
};

function formatDateTime(value?: string | null) {
    if (!value) return "Not scheduled";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not scheduled";
    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function statusLabel(status?: string) {
    return (status || "not_started").replace(/_/g, " ");
}

export default function SchedulePage() {
    const params = useParams();
    const eventId = Number(params.id);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["workspace", eventId],
        queryFn: () => workspaceApi.getWorkspaceOverview(eventId),
        enabled: Number.isFinite(eventId),
    });

    const workspaceData = data?.data;
    const rounds = useMemo<WorkspaceRound[]>(() => {
        return [...(workspaceData?.rounds || [])].sort((a, b) => {
            return (a.roundNumber ?? 0) - (b.roundNumber ?? 0);
        });
    }, [workspaceData?.rounds]);

    const currentRoundId = workspaceData?.currentActiveRound?.id;
    const nextDeadline = rounds.find((round) => {
        if (!round.submissionDeadline) return false;
        return new Date(round.submissionDeadline) >= new Date();
    });

    return (
        <div className="mx-auto max-w-[1100px] space-y-6">
            <div>
                <p className="text-sm font-medium uppercase tracking-[0.3em] text-orange-400">
                    Team workspace
                </p>

                <h1 className="mt-3 text-5xl font-bold tracking-tight text-foreground">
                    Schedule
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Live round timeline and submission deadlines from your team workspace.
                </p>
            </div>

            {isLoading ? (
                <GlassCard className="flex min-h-[260px] items-center justify-center border border-border">
                    <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                </GlassCard>
            ) : isError || !workspaceData ? (
                <GlassCard className="border border-border p-8">
                    <p className="font-semibold text-foreground">Unable to load workspace schedule.</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Please try again after your team workspace is available.
                    </p>
                </GlassCard>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-3">
                        <GlassCard className="border border-border p-5">
                            <div className="flex items-center gap-3">
                                <Trophy className="h-5 w-5 text-orange-400" />
                                <p className="text-sm text-muted-foreground">Current round</p>
                            </div>
                            <p className="mt-3 text-2xl font-semibold text-foreground">
                                {workspaceData.currentActiveRound?.name || "No active round"}
                            </p>
                        </GlassCard>

                        <GlassCard className="border border-border p-5">
                            <div className="flex items-center gap-3">
                                <Clock className="h-5 w-5 text-orange-400" />
                                <p className="text-sm text-muted-foreground">Next deadline</p>
                            </div>
                            <p className="mt-3 text-lg font-semibold text-foreground">
                                {nextDeadline ? formatDateTime(nextDeadline.submissionDeadline) : "No upcoming deadline"}
                            </p>
                        </GlassCard>

                        <GlassCard className="border border-border p-5">
                            <div className="flex items-center gap-3">
                                <CalendarClock className="h-5 w-5 text-orange-400" />
                                <p className="text-sm text-muted-foreground">Total rounds</p>
                            </div>
                            <p className="mt-3 text-2xl font-semibold text-foreground">{rounds.length}</p>
                        </GlassCard>
                    </div>

                    <GlassCard className="border border-border p-6">
                        <h2 className="text-xl font-semibold text-foreground">Round Timeline</h2>
                        <div className="mt-6 space-y-4">
                            {rounds.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No rounds have been configured for this event.</p>
                            ) : (
                                rounds.map((round) => {
                                    const isCurrent = round.id === currentRoundId;
                                    return (
                                        <div
                                            key={round.id}
                                            className="rounded-2xl border border-border bg-background/60 p-5"
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-4">
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                                        Round {round.roundNumber ?? "-"}
                                                    </p>
                                                    <h3 className="mt-2 text-lg font-semibold text-foreground">
                                                        {round.name || "Untitled round"}
                                                    </h3>
                                                </div>
                                                <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-medium capitalize text-orange-400">
                                                    {isCurrent ? "current" : statusLabel(round.status)}
                                                </span>
                                            </div>

                                            <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
                                                <div>
                                                    <p className="text-muted-foreground">Start</p>
                                                    <p className="mt-1 font-medium text-foreground">{formatDateTime(round.startDate)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground">Submission deadline</p>
                                                    <p className="mt-1 font-medium text-foreground">{formatDateTime(round.submissionDeadline)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground">End</p>
                                                    <p className="mt-1 font-medium text-foreground">{formatDateTime(round.endDate)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </GlassCard>

                    <GlassCard className="border border-border p-5">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
                            <div>
                                <p className="font-semibold text-foreground">Source: workspace API</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Mentor meetings, workshops, and custom calendar events are hidden until the backend exposes real schedule data for them.
                                </p>
                            </div>
                        </div>
                    </GlassCard>
                </>
            )}
        </div>
    );
}
