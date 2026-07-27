import { Award, Trophy, Medal, Star } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";

const awards = [
    {
        name: "First Prize - Spring 2026",
        description: "Web Platforms · OrbitWave",
        icon: Trophy,
        colorClass: "bg-yellow-400 text-yellow-950",
        shadowClass: "shadow-yellow-400/20",
        glowClass: "bg-yellow-400/10",
        borderHoverClass: "hover:border-yellow-400/40",
    },
    {
        name: "Second Prize - Summer 2026",
        description: "DevOps · NebulaForge",
        icon: Medal,
        colorClass: "bg-slate-300 text-slate-900",
        shadowClass: "shadow-slate-300/20",
        glowClass: "bg-slate-300/10",
        borderHoverClass: "hover:border-slate-300/40",
    },
    {
        name: "Third Prize - Fall 2025",
        description: "Fintech · Pixel Drift",
        icon: Medal,
        colorClass: "bg-amber-600 text-amber-50",
        shadowClass: "shadow-amber-600/20",
        glowClass: "bg-amber-600/10",
        borderHoverClass: "hover:border-amber-600/40",
    },
    {
        name: "Best UX Award",
        description: "Round 2 — SEAL Fall 2026",
        icon: Star,
        colorClass: "bg-blue-500 text-white",
        shadowClass: "shadow-blue-500/20",
        glowClass: "bg-blue-500/10",
        borderHoverClass: "hover:border-blue-500/40",
    },
    {
        name: "Finalist - Spring 2025",
        description: "AI Automation · DataMind",
        icon: Award,
        colorClass: "bg-purple-500 text-white",
        shadowClass: "shadow-purple-500/20",
        glowClass: "bg-purple-500/10",
        borderHoverClass: "hover:border-purple-500/40",
    },
];

export function AwardsSection() {
    return (
        <GlassCard>
            <h3 className="mb-4 text-sm font-semibold text-foreground">
                Awards & Achievements
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {awards.map((award) => (
                    <div
                        key={award.name}
                        className={`group relative overflow-hidden rounded-xl border border-border bg-white/[0.02] p-4 transition ${award.borderHoverClass}`}
                    >
                        <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-0 transition group-hover:opacity-100 ${award.glowClass}`} />

                        <div className="relative flex items-center gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-lg ${award.colorClass} ${award.shadowClass}`}>
                                <award.icon className="h-5 w-5" />
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold text-foreground">
                                    {award.name}
                                </h4>

                                <p className="text-[11px] text-muted-foreground">
                                    {award.description}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}