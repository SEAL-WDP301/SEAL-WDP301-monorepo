"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
    children: ReactNode;
    className?: string;
    glow?: boolean;
}

export function GlassCard({
    children,
    className,
    glow,
}: GlassCardProps) {
    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-2xl border border-border bg-card backdrop-blur-xl transition-all duration-300",
                "hover:border-orange-500/30",
                glow && "shadow-[0_0_40px_rgba(243,112,33,0.18)]",
                className
            )}
        >
            {children}
        </div>
    );
}
