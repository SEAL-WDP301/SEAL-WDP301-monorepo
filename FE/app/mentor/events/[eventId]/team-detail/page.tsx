"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";
import { getAssignedMentorTeams, getMentorProfile } from "@/lib/api/mentor.api";

import { MentorPageHeader } from "@/app/mentor/_components/mentor-page-header";
import { MentorEmptyState, MentorErrorState, MentorLoadingState } from "@/app/mentor/_components/mentor-query-state";

function initials(value?: string | null) {
  return (value || "?").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function TeamDetailPage() {
  const searchParams = useSearchParams();
  const teamId = Number(searchParams.get("teamId"));
  const query = useQuery({ queryKey: ["mentorProfile"], queryFn: getMentorProfile });

  if (query.isLoading) return <MentorLoadingState />;
  if (query.isError) return <MentorErrorState />;

  const team = getAssignedMentorTeams(query.data).find((item) => item.id === teamId);
  if (!team) return <MentorEmptyState title="Team not found" description="This team is not included in your current mentor assignments." />;

  return (
    <div className="mx-auto max-w-[1300px] space-y-6">
      <MentorPageHeader title={team.name} subtitle="Team information returned with your mentor assignment." />
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <GlassCard className="rounded-[24px] bg-card p-5">
          <Avatar className="h-20 w-20"><AvatarFallback className="text-2xl">{initials(team.name)}</AvatarFallback></Avatar>
          <h2 className="mt-4 text-2xl font-semibold">{team.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{team.event?.name || "Event unavailable"}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline">{team.track?.name || "No track"}</Badge>
            <Badge className="capitalize">{team.status || "Unknown status"}</Badge>
          </div>
        </GlassCard>
        <div className="space-y-5">
          <GlassCard className="rounded-[24px] bg-card p-6">
            <h2 className="text-lg font-semibold">Team leader</h2>
            <p className="mt-3 text-sm text-foreground">{team.leader?.name || "Name unavailable"}</p>
            <p className="text-sm text-muted-foreground">{team.leader?.email || "Email unavailable"}</p>
          </GlassCard>
          <GlassCard className="rounded-[24px] bg-card p-6">
            <h2 className="text-lg font-semibold">Members</h2>
            <div className="mt-4 space-y-3">
              {(team.members || []).map((member, index) => (
                <div key={member.id || member.user?.id || index} className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3">
                  <Avatar className="h-10 w-10"><AvatarFallback>{initials(member.user?.name)}</AvatarFallback></Avatar>
                  <div>
                    <p className="text-sm font-semibold">{member.user?.name || "Unknown member"}</p>
                    <p className="text-xs text-muted-foreground">{member.user?.email || "No email"} · {member.role || "member"}</p>
                  </div>
                </div>
              ))}
              {!team.members?.length ? <p className="text-sm text-muted-foreground">No members returned by backend.</p> : null}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
