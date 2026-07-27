import { Check, Circle, UserRound } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";

import type { Reminder } from "../mock-data";

type TeamRemindersCardProps = {
    reminders: Reminder[];
};

function getPriorityVariant(priority: Reminder["priority"]) {
    if (priority === "High") return "warning";
    if (priority === "Medium") return "default";
    return "outline";
}

export function TeamRemindersCard({ reminders }: TeamRemindersCardProps) {
    return (
        <GlassCard className="rounded-[24px] bg-card p-6 hover:-translate-y-1">
            <div className="mb-5 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-400">
                    <UserRound className="h-4 w-4" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        Team Reminders
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Small productivity checklist before submission.
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                {reminders.map((reminder) => (
                    <div
                        key={reminder.title}
                        className="flex items-center justify-between gap-3 rounded-[20px] border border-border bg-white/[0.035] p-4"
                    >
                        <div className="flex items-center gap-3">
                            <div className={reminder.done ? "text-orange-400" : "text-muted-foreground"}>
                                {reminder.done ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                            </div>
                            <div>
                                <p className={reminder.done ? "text-sm font-semibold text-foreground/70 line-through" : "text-sm font-semibold text-foreground"}>
                                    {reminder.title}
                                </p>
                                <Badge variant={getPriorityVariant(reminder.priority)} className="mt-2">
                                    {reminder.priority}
                                </Badge>
                            </div>
                        </div>

                        <Avatar className="h-9 w-9 border border-orange-500/25">
                            <AvatarFallback className="text-xs">
                                {reminder.assignee}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}
