import { Tag } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatSubmissionLabel,
  type JudgeSubmissionDetail,
} from "@/lib/api/judge.api";

interface TeamHeaderProps {
  detail?: JudgeSubmissionDetail | null;
  roundName?: string;
}

export function TeamHeader({ detail, roundName }: TeamHeaderProps) {
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
    <GlassCard className="p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 text-xl font-bold text-black shrink-0">
          {teamBadge}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold">{submissionLabel}</h2>
            <Badge 
              variant={detail.status.toLowerCase() === 'submitted' ? "outline" : "default"}
              className={cn(
                "capitalize",
                detail.status.toLowerCase() === 'submitted' ? "border-green-500 text-green-600 dark:border-green-400 dark:text-green-400" : ""
              )}
            >
              {detail.status}
            </Badge>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Tag size={16} />
              Track: {team.track?.name}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge variant="success">{roundName || detail.round.name}</Badge>
          {detail.round?.problemFileUrl && (
            <a
              href={detail.round.problemFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-semibold underline underline-offset-4 mt-1"
            >
              📌 Topic File
            </a>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
