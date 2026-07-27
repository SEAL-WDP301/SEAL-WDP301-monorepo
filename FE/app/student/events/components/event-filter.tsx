"use client";

import { Crown, Flame } from "lucide-react";

import { cn } from "@/lib/utils";

import { FILTERS } from "./constants";

type FilterType = (typeof FILTERS)[number];

interface EventFiltersProps {
    filters: readonly FilterType[];
    active: FilterType;
    onChange: (value: FilterType) => void;
}

export function EventFilters({ filters, active, onChange }: EventFiltersProps) {
    return (
        <div className="mb-6 flex flex-wrap items-center gap-2">
            {filters.map((filter) => (
                <button
                    key={filter}
                    onClick={() => onChange(filter)}
                    className={cn(
                        "rounded-full border px-4 py-2 text-xs font-semibold transition-all",
                        active === filter
                            ? "border-orange-500 bg-orange-500 text-black"
                            : "border-border bg-muted text-zinc-400 hover:border-orange-500/30 hover:text-foreground"
                    )}
                >
                    {filter === "Champion" && (
                        <Crown className="mr-1 inline h-3 w-3" />
                    )}

                    {filter === "Ongoing" && (
                        <Flame className="mr-1 inline h-3 w-3" />
                    )}

                    {filter}
                </button>
            ))}
        </div>
    );
}