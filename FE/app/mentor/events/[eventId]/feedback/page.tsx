"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { useParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { getMentorFeedback, MentorFeedback } from "@/lib/api/mentor.api";
import { MentorPageHeader } from "@/app/mentor/_components/mentor-page-header";
import {
  MentorEmptyState,
  MentorErrorState,
  MentorLoadingState,
} from "@/app/mentor/_components/mentor-query-state";

export default function FeedbackManagementPage() {
  const params = useParams();
  const query = useQuery({
    queryKey: ["mentorFeedback", params.eventId],
    queryFn: () => getMentorFeedback(params.eventId as string),
  });

  const feedbackItems = query.data || [];

  const groupedFeedbacks = useMemo(() => {
    const groups: Record<number, { teamName: string; teamId: number; feedbacks: MentorFeedback[] }> = {};
    for (const fb of feedbackItems) {
      const teamId = fb.teamId || fb.submission?.teamId || fb.team?.id;
      if (!teamId) continue;
      
      const teamName = fb.team?.name || fb.submission?.team?.name || `Team ${teamId}`;
      if (!groups[teamId]) {
        groups[teamId] = { teamName, teamId, feedbacks: [] };
      }
      groups[teamId].feedbacks.push(fb);
    }
    return Object.values(groups);
  }, [feedbackItems]);

  if (query.isLoading) return <MentorLoadingState />;
  if (query.isError) return <MentorErrorState />;

  return (
    <div className="mx-auto max-w-[1300px] space-y-6">
      <MentorPageHeader
        title="Feedback Management"
        subtitle="Feedback associated with your assigned team submissions."
      />
      {groupedFeedbacks.length === 0 ? (
        <MentorEmptyState
          title="No feedback yet"
          description="Feedback returned by the mentor API will appear here."
        />
      ) : (
        <div className="space-y-6">
          {groupedFeedbacks.map((group) => (
            <GlassCard key={group.teamId} className="rounded-[24px] bg-card p-6">
              <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
                <h2 className="text-xl font-bold">{group.teamName}</h2>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/mentor/events/${params.eventId}/teams/${group.teamId}`}>
                    View team
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="space-y-4">
                {group.feedbacks.map((feedback) => (
                  <div key={feedback.id} className="rounded-xl border border-border bg-muted/30 p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <Badge
                        variant={feedback.status === "completed" ? "success" : "outline"}
                      >
                        {feedback.status ? feedback.status.charAt(0).toUpperCase() + feedback.status.slice(1) : "Feedback"}
                      </Badge>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {feedback.content}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Created at{" "}
                      {feedback.createdAt
                        ? new Date(feedback.createdAt).toLocaleString()
                        : "an unavailable time"}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
