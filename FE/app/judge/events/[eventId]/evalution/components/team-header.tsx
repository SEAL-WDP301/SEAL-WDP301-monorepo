import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatSubmissionLabel,
  type JudgeSubmissionDetail,
} from "@/lib/api/judge.api";
import { ProblemStatementViewer } from "@/components/problem/problem-statement-viewer";

interface TeamHeaderProps {
  detail?: JudgeSubmissionDetail | null;
}

export function TeamHeader({ detail }: TeamHeaderProps) {
  if (!detail) {
    return (
      <GlassCard className="p-6">
        <p className="text-muted-foreground">Select a team to view their submission.</p>
      </GlassCard>
    );
  }

  const team = detail.team;
  const submissionLabel = team?.name || formatSubmissionLabel({
    id: detail.id,
    anonymousIndex: team?.anonymousIndex,
    teamName: team?.name,
  });
  const teamBadge = `T${team?.anonymousIndex ?? detail.id}`;

  return (
    <div className="space-y-3">
      <GlassCard className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-base font-bold text-black">
            {teamBadge}
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-bold">{submissionLabel}</h2>
            <Badge
              variant={detail.status.toLowerCase() === "submitted" ? "outline" : "default"}
              className={cn(
                "capitalize",
                detail.status.toLowerCase() === "submitted"
                  ? "border-green-500 text-green-600 dark:border-green-400 dark:text-green-400"
                  : "",
              )}
            >
              {detail.status}
            </Badge>
            {team.track?.name && (
              <Badge className="border-0 bg-orange-500/15 text-orange-700 dark:text-orange-300">
                Track: {team.track.name}
              </Badge>
            )}
          </div>
        </div>
      </GlassCard>

      {detail.round?.problemFileUrl && (
        <ProblemStatementViewer
          streamlined
          fileUrl={detail.round.problemFileUrl}
          title={`${detail.round.name} - Problem Statement`}
        />
      )}
    </div>
  );
}
