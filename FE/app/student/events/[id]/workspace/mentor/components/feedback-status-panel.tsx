import { AlertTriangle, CheckCircle2, CircleDot, MessageSquareText } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";

const icons = [MessageSquareText, CheckCircle2, CircleDot, AlertTriangle];

type FeedbackStatusPanelProps = {
    stats: Array<{
        label: string;
        value: string;
    }>;
    resolvedProgress: number;
};

export function FeedbackStatusPanel({ stats, resolvedProgress }: FeedbackStatusPanelProps) {
    return (
        <GlassCard className="rounded-[24px] bg-card p-6 hover:-translate-y-1">
            <div className="mb-5">
                <h2 className="text-lg font-semibold text-foreground">
                    Feedback Status
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Review health across the current round.
                </p>
            </div>

            <div className="grid gap-3">
                {stats.map((stat, index) => {
                    const Icon = icons[index];

                    return (
                        <div
                            key={stat.label}
                            className="flex items-center gap-3 rounded-2xl border border-border bg-white/[0.035] p-3"
                        >
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
                                <Icon className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">
                                    {stat.label}
                                </p>
                                <p className="text-lg font-semibold text-foreground">
                                    {stat.value}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Resolved progress</span>
                    <span className="font-semibold text-orange-300">{resolvedProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-[#ff8a3d] to-[#f37021]"
                        style={{ width: `${resolvedProgress}%` }}
                    />
                </div>
            </div>
        </GlassCard>
    );
}
