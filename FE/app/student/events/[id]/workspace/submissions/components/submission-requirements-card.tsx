import { Check, Circle } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";

import type { Requirement } from "../mock-data";

type SubmissionRequirementsCardProps = {
    requirements: Requirement[];
};

export function SubmissionRequirementsCard({ requirements }: SubmissionRequirementsCardProps) {
    return (
        <GlassCard className="rounded-[24px] bg-card p-6 hover:-translate-y-1">
            <div className="mb-5">
                <h2 className="text-lg font-semibold text-foreground">
                    Submission Requirements
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Final submission will unlock after all checklist items are complete.
                </p>
            </div>

            <div className="space-y-3">
                {requirements.map((requirement) => {
                    const completed = requirement.status === "completed";

                    return (
                        <div
                            key={requirement.label}
                            className="flex items-center gap-3 rounded-2xl border border-border bg-white/[0.035] p-3"
                        >
                            <div className={completed ? "text-orange-400" : "text-muted-foreground"}>
                                {completed ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                            </div>
                            <p className={completed ? "text-sm font-medium text-foreground" : "text-sm text-muted-foreground"}>
                                {requirement.label}
                            </p>
                        </div>
                    );
                })}
            </div>
        </GlassCard>
    );
}
