"use client";

import Link from "next/link";
import { AlertCircle, Calendar, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

export default function StudentEventsPage() {
    return (
        <div className="space-y-6">
            <div>
                <p className="text-sm font-medium uppercase tracking-[0.3em] text-orange-400">
                    My Events
                </p>

                <h1 className="mt-3 text-5xl font-bold tracking-tight text-foreground">
                    Hackathon History
                </h1>

                <p className="mt-2 text-sm text-muted-foreground">
                    Your participated event history will appear here once the backend exposes a student events endpoint.
                </p>
            </div>

            <GlassCard className="border border-border">
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10">
                        <Calendar className="h-8 w-8 text-orange-400" />
                    </div>

                    <h2 className="mt-6 text-2xl font-semibold text-foreground">
                        Event history API is not available
                    </h2>

                    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                        This page no longer shows hardcoded event history. Add a backend endpoint for the current student&apos;s registered events, teams, ranks, and submissions to enable this view.
                    </p>

                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                        <Button asChild variant="orange" className="rounded-xl">
                            <Link href="/home">
                                <Search className="mr-2 h-4 w-4" />
                                Browse public events
                            </Link>
                        </Button>

                        <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                            <AlertCircle className="h-4 w-4 text-orange-400" />
                            Waiting for student event history API
                        </div>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
