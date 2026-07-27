"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, MessageSquareText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { getMentorSubmission } from "@/lib/api/mentor.api";
import { MentorPageHeader } from "@/app/mentor/_components/mentor-page-header";
import {
  MentorEmptyState,
  MentorErrorState,
  MentorLoadingState,
} from "@/app/mentor/_components/mentor-query-state";

export default function MentorSubmissionDetailPage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const submissionId = params.submissionId as string;

  const query = useQuery({
    queryKey: ["mentorSubmission", submissionId],
    queryFn: () => getMentorSubmission(submissionId),
  });

  if (query.isLoading) return <MentorLoadingState />;
  if (query.isError || !query.data) return <MentorErrorState />;

  const submission = query.data;
  const hasResources = Boolean(
    submission.fileUrl ||
      submission.githubUrl ||
      submission.demoUrl ||
      submission.slideUrl
  );

  return (
    <div className="mx-auto max-w-[1300px] space-y-6">
      <MentorPageHeader
        title={submission.round?.name || "Submission Detail"}
        subtitle={`${submission.team?.name || `Team ${submission.teamId}`} · Read-only submission details.`}
        actions={
          <Button asChild variant="outline" className="rounded-xl">
            <Link href={`/mentor/events/${params.eventId}/teams/${teamId}`}>Back to team</Link>
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <main className="space-y-5">
          <GlassCard className="rounded-[24px] bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Submitted resources</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {submission.updatedAt
                    ? `Updated ${new Date(submission.updatedAt).toLocaleString()}`
                    : "Update time unavailable"}
                </p>
              </div>
              <Badge variant="outline" className="capitalize">
                {submission.status || "submitted"}
              </Badge>
            </div>

            {hasResources ? (
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {submission.fileUrl ? (
                  <ResourceLink
                    label="Submitted file"
                    href={submission.fileUrl}
                    file
                  />
                ) : null}
                {submission.githubUrl ? (
                  <ResourceLink
                    label="Git repository"
                    href={submission.githubUrl}
                  />
                ) : null}
                {submission.demoUrl ? (
                  <ResourceLink label="Demo" href={submission.demoUrl} />
                ) : null}
                {submission.slideUrl ? (
                  <ResourceLink
                    label="Presentation slides"
                    href={submission.slideUrl}
                  />
                ) : null}
              </div>
            ) : (
              <div className="mt-5">
                <MentorEmptyState
                  title="No submitted resources"
                  description="The API response does not contain a file or external URL."
                />
              </div>
            )}

            {submission.description ? (
              <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Team notes
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                  {submission.description}
                </p>
              </div>
            ) : null}
          </GlassCard>
        </main>

        <GlassCard className="h-fit rounded-[24px] bg-card p-6 xl:sticky xl:top-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Mentor feedback</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Feedback returned with this submission.
              </p>
            </div>
            <Badge
              variant={
                submission.feedback?.status === "published" ? "success" : "outline"
              }
            >
              {submission.feedback?.status || "None"}
            </Badge>
          </div>

          {submission.feedback?.content ? (
            <p className="mt-5 whitespace-pre-wrap rounded-2xl border border-border bg-muted/30 p-4 text-sm leading-7">
              {submission.feedback.content}
            </p>
          ) : (
            <div className="mt-6 flex flex-col items-center py-8 text-center">
              <MessageSquareText className="h-7 w-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No feedback available</p>
              <Button asChild variant="outline" className="mt-4 rounded-xl">
                <Link href={`/mentor/events/${params.eventId}/teams/${teamId}`}>
                  Write Feedback in Team Dashboard
                </Link>
              </Button>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function ResourceLink({
  label,
  href,
  file = false,
}: {
  label: string;
  href: string;
  file?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4 transition-colors hover:border-orange-500/40"
    >
      <span className="flex items-center gap-2 font-medium">
        {file ? (
          <FileText className="h-4 w-4 text-primary" />
        ) : (
          <ExternalLink className="h-4 w-4 text-primary" />
        )}
        {label}
      </span>
      <ExternalLink className="h-4 w-4 text-muted-foreground" />
    </a>
  );
}
