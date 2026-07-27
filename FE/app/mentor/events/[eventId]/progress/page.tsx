"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMentorTeams } from "@/lib/api/mentor.api";

import { MentorPageHeader } from "@/app/mentor/_components/mentor-page-header";
import { MentorEmptyState, MentorErrorState, MentorLoadingState } from "@/app/mentor/_components/mentor-query-state";

export default function TeamProgressPage() {
  const params = useParams();
  const query = useQuery({ 
    queryKey: ["mentorTeams", params.eventId], 
    queryFn: () => getMentorTeams(params.eventId as string) 
  });
  if (query.isLoading) return <MentorLoadingState />;
  if (query.isError) return <MentorErrorState />;

  const teams = query.data || [];
  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <MentorPageHeader title="Team Progress" subtitle="Backend team status for teams assigned to you." />
      {teams.length === 0 ? (
        <MentorEmptyState title="No progress data" description="Progress becomes available after an organizer assigns you to a team." />
      ) : (
        <GlassCard className="rounded-[24px] bg-card p-6">
          <Table>
            <TableHeader>
              <TableRow>
                {["Team", "Event", "Track", "Members", "Backend status", "Actions"].map((head) => <TableHead key={head}>{head}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-semibold">{team.name}</TableCell>
                  <TableCell>{team.event?.name || "N/A"}</TableCell>
                  <TableCell>{team.track?.name || "N/A"}</TableCell>
                  <TableCell>{team.members?.length || 0}</TableCell>
                  <TableCell className="capitalize">{team.status || "N/A"}</TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/mentor/events/${params.eventId}/teams/${team.id}`}><Eye className="h-4 w-4" />View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
      )}
    </div>
  );
}
