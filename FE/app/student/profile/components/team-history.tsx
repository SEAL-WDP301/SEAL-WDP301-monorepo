"use client";

import { GlassCard } from "@/components/ui/glass-card";

const teams = [
    {
        name: "NebulaForge",
        role: "2026 · Lead",
    },
    {
        name: "OrbitWave",
        role: "2025–2026 · Backend",
    },
    {
        name: "Pixel Drift",
        role: "2024–2025 · Member",
    },
];

export function TeamHistory() {
    return (
        <GlassCard>
            <h3 className="text-sm font-semibold text-foreground">
                Team history
            </h3>

            <div className="mt-3 space-y-2 text-xs">
                {teams.map((team) => (
                    <div
                        key={team.name}
                        className="flex items-center justify-between rounded-lg border border-border bg-white/[0.02] px-3 py-2"
                    >
                        <span className="font-medium text-foreground">
                            {team.name}
                        </span>

                        <span className="text-xs text-muted-foreground">
                            {team.role}
                        </span>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}