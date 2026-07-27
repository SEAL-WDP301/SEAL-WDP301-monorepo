import { Eye } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

import type { HistoryItem } from "../mock-data";

type SubmissionHistoryCardProps = {
    history: HistoryItem[];
};

export function SubmissionHistoryCard({ history }: SubmissionHistoryCardProps) {
    return (
        <GlassCard className="rounded-[24px] bg-card p-6 hover:-translate-y-1">
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-foreground">
                    Submission History
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Track every saved draft and submitted version.
                </p>
            </div>

            <div className="space-y-5">
                {history.map((item, index) => (
                    <div key={`${item.version}-${item.timestamp}`} className="relative flex gap-4">
                        {index < history.length - 1 ? (
                            <span className="absolute left-5 top-11 h-[calc(100%_-_0.5rem)] w-px bg-white/10" />
                        ) : null}

                        <Avatar className="h-10 w-10 border border-orange-500/25">
                            <AvatarFallback>
                                {item.initials}
                            </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 rounded-[20px] border border-border bg-white/[0.035] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge>
                                        {item.version}
                                    </Badge>
                                    <p className="text-sm font-semibold text-foreground">
                                        {item.user} {item.action}
                                    </p>
                                </div>
                                <Button variant="ghost" size="sm" className="rounded-xl text-orange-400 hover:bg-orange-500/10 hover:text-orange-300">
                                    <Eye className="h-4 w-4" />
                                    View
                                </Button>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                                {item.timestamp}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}
