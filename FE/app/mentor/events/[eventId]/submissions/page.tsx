"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ExternalLink, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { getMentorSubmissions } from "@/lib/api/mentor.api";
import { MentorPageHeader } from "@/app/mentor/_components/mentor-page-header";
import {
  MentorEmptyState,
  MentorErrorState,
  MentorLoadingState,
} from "@/app/mentor/_components/mentor-query-state";

export default function SubmissionsReviewPage() {
  const params = useParams();
  const query = useQuery({
    queryKey: ["mentorSubmissions", params.eventId],
    queryFn: () => getMentorSubmissions(params.eventId as string),
  });

  if (query.isLoading) return <MentorLoadingState />;
  if (query.isError) return <MentorErrorState />;

  const submissions = query.data || [];

  return (
    <div className="mx-auto max-w-[1300px] space-y-6">
      <MentorPageHeader
        title="Submissions Review"
        subtitle="Submissions from teams assigned to your mentor account."
      />
      {submissions.length === 0 ? (
        <MentorEmptyState
          title="No submissions available"
          description="Assigned team submissions will appear here."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {submissions.map((submission) => (
            <GlassCard key={submission.id} className="rounded-[24px] bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold">
                      {submission.team?.name || `Team ${submission.teamId}`}
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {submission.round?.name || `Round ${submission.roundId}`}
                  </p>
                </div>
                <Badge variant={submission.feedback ? "success" : "outline"}>
                  {submission.feedback?.status || "No feedback"}
                </Badge>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                Updated{" "}
                {submission.updatedAt
                  ? new Date(submission.updatedAt).toLocaleString()
                  : "at an unavailable time"}
              </p>

              <Button asChild variant="orange" className="mt-5 w-full">
                <Link
                  href={`/mentor/events/${params.eventId}/teams/${submission.teamId}`}
                >
                  View submission
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
