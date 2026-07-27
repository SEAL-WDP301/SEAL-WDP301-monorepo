import { Check, Lock, Zap } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

import type { RoadmapStep } from "../mock-data";

type RoundRoadmapCardProps = {
    steps: RoadmapStep[];
};

export function RoundRoadmapCard({ steps }: RoundRoadmapCardProps) {
    return (
        <GlassCard className="rounded-[24px] bg-card p-6 hover:-translate-y-1">
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-foreground">
                    Round Roadmap
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Overall SEAL Hackathon flow and current position.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-6">
                {steps.map((step, index) => {
                    const completed = step.state === "completed";
                    const current = step.state === "current";
                    const locked = step.state === "locked";

                    return (
                        <div key={step.label} className="relative">
                            {index < steps.length - 1 ? (
                                <div className="absolute left-10 top-5 hidden h-px w-[calc(100%_-_1.5rem)] bg-white/10 md:block">
                                    <div className={cn("h-full", completed ? "bg-orange-500" : "bg-transparent")} />
                                </div>
                            ) : null}

                            <div className="relative flex items-center gap-3 md:flex-col md:items-start">
                                <div
                                    className={cn(
                                        "z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                                        completed && "border-orange-500 bg-orange-500 text-black",
                                        current && "border-orange-400 bg-orange-500/10 text-orange-400 shadow-[0_0_0_6px_rgba(243,112,33,0.12),0_0_28px_rgba(243,112,33,0.38)]",
                                        locked && "border-border bg-muted text-muted-foreground"
                                    )}
                                >
                                    {completed ? <Check className="h-4 w-4" /> : null}
                                    {current ? <Zap className="h-4 w-4" /> : null}
                                    {locked ? <Lock className="h-4 w-4" /> : null}
                                </div>
                                <p className={cn("text-sm font-semibold md:mt-3", locked ? "text-muted-foreground" : "text-foreground")}>
                                    {step.label}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </GlassCard>
    );
}
