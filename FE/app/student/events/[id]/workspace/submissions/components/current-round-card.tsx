import { AlertTriangle, CalendarClock, FileCheck2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

import type { CurrentRound } from "../mock-data";

type CurrentRoundCardProps = {
    round: CurrentRound;
};

export function CurrentRoundCard({ round }: CurrentRoundCardProps) {
    const progressPercent = Math.round(
        (round.completedRequirements / round.totalRequirements) * 100
    );
    const canSubmit = round.completedRequirements === round.totalRequirements;

    return (
        <GlassCard glow className="rounded-[24px] bg-card p-6 hover:-translate-y-1">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange-500/15 blur-[90px]" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-500/25 bg-orange-500/10 text-orange-400">
                        <FileCheck2 className="h-6 w-6" />
                    </div>
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                        {round.name}
                    </h2>
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarClock className="h-4 w-4 text-orange-400" />
                        Due date: {round.dueDate}
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <Button
                        variant="orange"
                        className="rounded-2xl px-5"
                        disabled={!canSubmit}
                    >
                        Submit Final
                    </Button>
                    <Button
                        variant="outline"
                        className="rounded-2xl border-border bg-muted px-5"
                    >
                        Save Draft
                    </Button>
                </div>
            </div>

            <div className="relative mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {round.requiredFiles.map((file) => (
                    <div
                        key={file}
                        className="rounded-[20px] border border-border bg-white/[0.035] p-4"
                    >
                        <p className="text-sm font-semibold text-foreground">
                            {file}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Required deliverable
                        </p>
                    </div>
                ))}
            </div>

            <div className="relative mt-6 rounded-[20px] border border-border bg-white/[0.035] p-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-foreground">
                        {round.completedRequirements} / {round.totalRequirements} requirements completed
                    </p>
                    <p className="text-sm text-orange-300">
                        {progressPercent}%
                    </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-[#ff8a3d] to-[#f37021]"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>

                {!canSubmit ? (
                    <div className="mt-4 flex items-start gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-3 text-sm text-orange-200">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        Complete every required field before final submission. Show a clear confirmation before submitting.
                    </div>
                ) : null}
            </div>
        </GlassCard>
    );
}
