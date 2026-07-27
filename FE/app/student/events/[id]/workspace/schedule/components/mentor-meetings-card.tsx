import { FileText, RotateCcw, Video } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

import type { MentorMeeting } from "../mock-data";

type MentorMeetingsCardProps = {
    meetings: MentorMeeting[];
};

export function MentorMeetingsCard({ meetings }: MentorMeetingsCardProps) {
    return (
        <GlassCard className="rounded-[24px] bg-card p-6 hover:-translate-y-1">
            <div className="mb-5">
                <h2 className="text-lg font-semibold text-foreground">
                    Mentor Meetings
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Upcoming mentor sessions for this round.
                </p>
            </div>

            <div className="space-y-3">
                {meetings.map((meeting) => (
                    <div
                        key={`${meeting.title}-${meeting.datetime}`}
                        className="rounded-[20px] border border-border bg-white/[0.035] p-4 transition-all duration-300 hover:border-orange-500/25"
                    >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12 border border-orange-500/25">
                                    <AvatarFallback>
                                        {meeting.initials}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold text-foreground">
                                        {meeting.title}
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {meeting.mentor} · {meeting.datetime}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">
                                    {meeting.type}
                                </Badge>
                                <Button variant="orange" size="sm" className="rounded-xl">
                                    <Video className="h-4 w-4" />
                                    Join
                                </Button>
                                <Button variant="ghost" size="sm" className="rounded-xl text-orange-400 hover:bg-orange-500/10 hover:text-orange-300">
                                    <FileText className="h-4 w-4" />
                                    Notes
                                </Button>
                                <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground hover:bg-white/[0.05] hover:text-foreground">
                                    <RotateCcw className="h-4 w-4" />
                                    Reschedule
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}
