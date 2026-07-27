import { AlertTriangle, ArrowRight, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

import type { DeadlineSummary } from "../mock-data";

type DeadlineTrackerCardProps = {
    deadline: DeadlineSummary;
};

export function DeadlineTrackerCard({ deadline }: DeadlineTrackerCardProps) {
    return (
        <GlassCard glow className="rounded-[24px] border-orange-500/20 bg-card p-6 hover:-translate-y-1">
            <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        Deadline Tracker
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Important submission countdown.
                    </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-400">
                    <AlertTriangle className="h-5 w-5" />
                </div>
            </div>

            <p className="text-2xl font-semibold tracking-tight text-foreground">
                {deadline.title}
            </p>
            <p className="mt-2 text-sm font-semibold text-orange-300">
                {deadline.countdown}
            </p>

            <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Completion state</span>
                    <span className="font-semibold text-orange-300">{deadline.progress}% completed</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-[#ff8a3d] to-[#f37021]"
                        style={{ width: `${deadline.progress}%` }}
                    />
                </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="orange" className="rounded-2xl">
                    <UploadCloud className="h-4 w-4" />
                    Upload Submission
                </Button>
                <Button variant="outline" className="rounded-2xl border-border bg-muted">
                    View Requirements
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </div>
        </GlassCard>
    );
}
