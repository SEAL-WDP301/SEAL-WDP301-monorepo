"use client"

import React from "react"
import { GlassCard } from "@/components/ui/glass-card"

export function PageHeader({
    eyebrow,
    title,
    description,
}: {
    eyebrow?: string
    title: string
    description?: string
}) {
    return (
        <div className="mb-6">
            {eyebrow && <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{eyebrow}</p>}
            <h1 className="text-3xl font-bold">{title}</h1>
            {description && <p className="text-muted-foreground mt-2">{description}</p>}
        </div>
    )
}

export { GlassCard }
