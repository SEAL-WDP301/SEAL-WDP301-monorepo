import { CheckCircle2, TrendingUp } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";
import type { StudentWorkspaceMentor } from "@/lib/api/mentor.api";

function initials(name?: string | null) {
    return (name || "M")
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

export function MentorHeroCard({
    mentor,
    feedbackCount,
    roundName,
}: {
    mentor: StudentWorkspaceMentor;
    feedbackCount: number;
    roundName?: string;
}) {
    const profile = mentor.stakeholderProfile;
    const avatarUrl = mentor.avatarUrl || mentor.avatar_url || undefined;
    const role = profile?.jobTitle || "Assigned Mentor";
    const organization = profile?.organization || profile?.organizationName;

    return (
        <GlassCard glow className="rounded-[24px] bg-card p-6 hover:-translate-y-1">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange-500/15 blur-[90px]" />
            <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="flex flex-col gap-5 sm:flex-row">
                    <div className="relative shrink-0">
                        <div className="absolute inset-0 rounded-full bg-orange-500/30 blur-2xl" />
                        <Avatar className="relative h-24 w-24 border border-orange-500/30">
                            {avatarUrl ? (
                                <AvatarImage src={avatarUrl} alt={mentor.name || "Mentor"} />
                            ) : null}
                            <AvatarFallback className="text-2xl">
                                {initials(mentor.name)}
                            </AvatarFallback>
                        </Avatar>
                    </div>

                    <div>
                        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                            {mentor.name || "Assigned Mentor"}
                        </h2>
                        <p className="mt-2 text-sm font-medium text-orange-300">
                            {role}
                            {organization ? ` · ${organization}` : ""}
                        </p>
                        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
                            {profile?.bio || "Mentor profile information is not available."}
                        </p>

                        {profile?.experience ? (
                            <p className="mt-4 text-sm text-muted-foreground">
                                Experience: {profile.experience}
                            </p>
                        ) : null}
                    </div>
                </div>

                <div className="rounded-[22px] border border-border bg-white/[0.035] p-5">
                    <Badge>
                        {roundName || "Mentor Review"}
                    </Badge>
                    <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Published feedback</span>
                            <span className="font-semibold text-orange-300">{feedbackCount}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-[#ff8a3d] to-[#f37021]"
                                style={{ width: feedbackCount > 0 ? "100%" : "0%" }}
                            />
                        </div>
                    </div>

                    <div className="mt-5 space-y-3">
                        <div className="flex items-center gap-3 rounded-2xl border border-border bg-white/[0.04] p-3">
                            <TrendingUp className="h-4 w-4 text-orange-400" />
                            <span className="text-sm text-foreground">
                                {feedbackCount > 0
                                    ? "Mentor feedback is available"
                                    : "Waiting for mentor feedback"}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 rounded-2xl border border-border bg-white/[0.04] p-3">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span className="text-sm text-foreground">
                                {mentor.email || "Mentor contact unavailable"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </GlassCard>
    );
}
