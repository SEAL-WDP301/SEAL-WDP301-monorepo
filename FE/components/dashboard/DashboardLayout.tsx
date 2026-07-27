"use client"

import React from "react"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-4">
            {children}
        </div>
    )
}
