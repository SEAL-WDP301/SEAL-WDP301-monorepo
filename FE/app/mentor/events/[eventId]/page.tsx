"use client";

import Link from "next/link";
import { Bell, UsersRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import {
  getMentorNotifications,
  getMentorProfile,
  getMentorTeams,
} from "@/lib/api/mentor.api";
import { MentorPageHeader } from "@/app/mentor/_components/mentor-page-header";
import { MentorEmptyState, MentorErrorState, MentorLoadingState } from "@/app/mentor/_components/mentor-query-state";
import { PublicEventOnlineMeetingCard } from "@/components/events/public-event-online-meeting-card";

export default function MentorDashboardPage() {
  const params = useParams();
  const profileQuery = useQuery({ queryKey: ["mentorProfile"], queryFn: getMentorProfile });
  const teamsQuery = useQuery({ 
    queryKey: ["mentorTeams", params.eventId], 
    queryFn: () => getMentorTeams(params.eventId as string) 
  });
  const notificationsQuery = useQuery({ queryKey: ["userNotifications"], queryFn: getMentorNotifications });

  if (
    profileQuery.isLoading ||
    teamsQuery.isLoading ||
    notificationsQuery.isLoading
  ) {
    return <MentorLoadingState />;
  }
  if (
    profileQuery.isError ||
    teamsQuery.isError ||
    notificationsQuery.isError
  ) {
    return <MentorErrorState />;
  }

  const teams = teamsQuery.data || [];
  const rawNotifications = notificationsQuery.data;
  const notifications = Array.isArray(rawNotifications) 
    ? rawNotifications 
    : (rawNotifications as any)?.pages?.flatMap((p: any) => p.data) || [];
  
  const stats = [
    { label: "Assigned teams", value: teams.length, icon: UsersRound },
    { label: "Notifications", value: notifications.length, icon: Bell },
    { label: "Unread updates", value: notifications.filter((item: any) => !item.isRead).length, icon: Bell },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <MentorPageHeader
        title={`Welcome${profileQuery.data?.name ? `, ${profileQuery.data.name}` : ""}`}
        subtitle="Monitor teams assigned to you by the organizer."
        actions={<Button asChild variant="outline"><Link href={`/mentor/events/${params.eventId}/teams`}>View teams</Link></Button>}
      />
      <PublicEventOnlineMeetingCard eventId={params.eventId as string} />
      <section className="grid gap-4 md:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <GlassCard key={label} className="rounded-[22px] bg-card p-5">
            <Icon className="h-5 w-5 text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </GlassCard>
        ))}
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <GlassCard className="rounded-[24px] bg-card p-6">
          <h2 className="text-lg font-semibold">Assigned teams</h2>
          <div className="mt-5 space-y-3">
            {teams.length === 0 ? (
              <MentorEmptyState title="No teams assigned" description="An organizer must assign this mentor account to a team." />
            ) : teams.map((team) => (
              <Link key={team.id} href={`/mentor/events/${params.eventId}/teams/${team.id}`} className="block rounded-2xl border border-border bg-muted/40 p-4 hover:border-orange-500/40">
                <p className="font-semibold">{team.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{team.event?.name || "Event unavailable"} · {team.track?.name || "Track unavailable"}</p>
              </Link>
            ))}
          </div>
        </GlassCard>
        <GlassCard className="rounded-[24px] bg-card p-6">
          <h2 className="text-lg font-semibold">Recent notifications</h2>
          <div className="mt-5 space-y-3">
            {notifications.slice(0, 5).map((item: any) => (
              <div key={item.id} className="rounded-2xl border border-border bg-muted/40 p-4">
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.content}</p>
              </div>
            ))}
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications.</p>
            ) : null}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
