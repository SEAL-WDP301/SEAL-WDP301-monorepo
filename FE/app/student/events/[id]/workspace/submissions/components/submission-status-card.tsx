import { EyeOff, Timer, UploadCloud, UserRound } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";

import type { SubmissionStatusSummary } from "../mock-data";
import { SubmissionStatusBadge } from "./submission-status-badge";

type SubmissionStatusCardProps = {
    status: SubmissionStatusSummary;
};

export function SubmissionStatusCard({ status }: SubmissionStatusCardProps) {
    const rows = [
        { label: "Last updated", value: status.lastUpdated, icon: Timer },
        { label: "Uploaded by", value: status.uploadedBy, icon: UserRound },
        { label: "Version", value: status.version, icon: UploadCloud },
        { label: "Current score", value: status.scoreVisibility, icon: EyeOff },
    ];

    return (
        <GlassCard className="rounded-[24px] bg-card p-6 hover:-translate-y-1">
            <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        Submission Status
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Current draft state and review visibility.
                    </p>
                </div>
                <SubmissionStatusBadge status={status.status} />
            </div>

            <div className="grid gap-3">
                {rows.map((row) => {
                    const Icon = row.icon;

                    return (
                        <div
                            key={row.label}
                            className="flex items-center gap-3 rounded-2xl border border-border bg-white/[0.035] p-3"
                        >
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
                                <Icon className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">
                                    {row.label}
                                </p>
                                <p className="text-sm font-semibold text-foreground">
                                    {row.value}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </GlassCard>
    );
}
