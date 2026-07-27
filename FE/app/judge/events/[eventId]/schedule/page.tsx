"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, CalendarClock, ClipboardCheck, Loader2 } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { useJudgeWorkspace } from "@/lib/hooks/use-judge-workspace";

function formatDateTime(value?: string | null) {
    if (!value) return "No deadline";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No deadline";
    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

export default function SchedulePage() {
    const params = useParams();
    const eventId = params.eventId as string;
    const { events, submissions, isLoading, isError } = useJudgeWorkspace(eventId);

    const assignedRounds = useMemo(() => {
        return events.flatMap((event) =>
            event.rounds.map((round) => ({
                ...round,
                eventName: event.name,
                eventId: event.id,
                key: `${event.id}-${round.roundId}-${round.trackId ?? "all"}`,
            })),
        ).sort((a, b) => {
            const aDate = a.submissionDeadline ? new Date(a.submissionDeadline).getTime() : Number.MAX_SAFE_INTEGER;
            const bDate = b.submissionDeadline ? new Date(b.submissionDeadline).getTime() : Number.MAX_SAFE_INTEGER;
            return aDate - bDate;
        });
    }, [events]);

    const upcomingRounds = assignedRounds.filter((round) => {
        if (!round.submissionDeadline) return false;
        return new Date(round.submissionDeadline) >= new Date();
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="mt-3 text-5xl font-bold tracking-tight text-foreground">
                    Schedule
                </h1>

                <p className="mt-2 text-sm text-muted-foreground">
                    Assigned judging rounds and submission deadlines from the judge API.
                </p>
            </div>

            {isLoading ? (
                <GlassCard className="flex min-h-[260px] items-center justify-center border border-border">
                    <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                </GlassCard>
            ) : isError ? (
                <GlassCard className="border border-border p-8">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-red-400" />
                        <div>
                            <p className="font-semibold text-foreground">Unable to load judge schedule.</p>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Please try again after your judge assignments are available.
                            </p>
                        </div>
                    </div>
                </GlassCard>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-3">
                        <GlassCard className="border border-border p-5">
                            <div className="flex items-center gap-3">
                                <CalendarClock className="h-5 w-5 text-orange-400" />
                                <p className="text-sm text-muted-foreground">Assigned rounds</p>
                            </div>
                            <p className="mt-3 text-3xl font-semibold text-foreground">{assignedRounds.length}</p>
                        </GlassCard>

                        <GlassCard className="border border-border p-5">
                            <div className="flex items-center gap-3">
                                <ClipboardCheck className="h-5 w-5 text-orange-400" />
                                <p className="text-sm text-muted-foreground">Assigned submissions</p>
                            </div>
                            <p className="mt-3 text-3xl font-semibold text-foreground">{submissions.length}</p>
                        </GlassCard>

                        <GlassCard className="border border-border p-5">
                            <div className="flex items-center gap-3">
                                <CalendarClock className="h-5 w-5 text-orange-400" />
                                <p className="text-sm text-muted-foreground">Upcoming deadlines</p>
                            </div>
                            <p className="mt-3 text-3xl font-semibold text-foreground">{upcomingRounds.length}</p>
                        </GlassCard>
                    </div>

                    <GlassCard className="border border-border p-6">
                        <h2 className="text-xl font-semibold text-foreground">Round Deadlines</h2>
                        <div className="mt-6 space-y-4">
                            {assignedRounds.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No assigned rounds yet.</p>
                            ) : (
                                assignedRounds.map((round) => (
                                    <div key={round.key} className="rounded-2xl border border-border bg-background/60 p-5">
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                                    {round.eventName}
                                                </p>
                                                <h3 className="mt-2 text-lg font-semibold text-foreground">
                                                    Round {round.roundNumber}: {round.roundName}
                                                </h3>
                                                {round.trackName ? (
                                                    <p className="mt-1 text-sm text-muted-foreground">Track: {round.trackName}</p>
                                                ) : null}
                                            </div>

                                            <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-medium capitalize text-orange-400">
                                                {round.roundStatus.replace(/_/g, " ")}
                                            </span>
                                        </div>

                                        <div className="mt-5 text-sm">
                                            <p className="text-muted-foreground">Submission deadline</p>
                                            <p className="mt-1 font-medium text-foreground">
                                                {formatDateTime(round.submissionDeadline)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </GlassCard>

                </>
            )}
        </div>
    );
}
