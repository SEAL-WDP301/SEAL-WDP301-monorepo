"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { useJudgeWorkspace } from "@/lib/hooks/use-judge-workspace";
import { mapScoringStatusLabel } from "@/lib/api/judge.api";

export function TodayEvaluations() {
  const params = useParams();
  const { pendingSubmissions, submissions, isLoading } = useJudgeWorkspace(params.eventId as string);

  const displayTeams = pendingSubmissions.length
    ? pendingSubmissions.slice(0, 6)
    : submissions.slice(0, 6);

  const isPendingView = pendingSubmissions.length > 0;

  return (
    <GlassCard className="p-6">
      <div className="mb-5 flex items-center justify-between space-y-4">
        <div>
          <h2 className="flex items-center gap-5 text-lg font-semibold">
            <span className={`h-2 w-2 rounded-full ${isPendingView ? 'glow-orange-sm bg-primary' : 'glow-green-sm bg-green-500'}`} />
            {isPendingView ? "Pending Evaluations" : "Recent Evaluations"}
          </h2>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {isPendingView ? "Teams awaiting your review (from API)" : "All caught up! Showing recently reviewed teams."}
          </p>
        </div>

        <Link
          href={`/judge/events/${params.eventId}/evalution`}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Open workspace
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </div>
      ) : displayTeams.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No submissions are available in your assigned rounds.
          Teams must submit their work before it appears here.
          No submissions in your assigned rounds.
          Teams need to submit before they appear here.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {displayTeams.map((team, index) => {
            const submissionId = team.submissionId ?? team.id;
            const href = `/judge/events/${params.eventId}/evalution?roundId=${team.roundId}`;
            const statusLabel = mapScoringStatusLabel(team.scoringStatus);

            return (
              <motion.div
                key={submissionId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="group flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4 transition hover:border-primary/40 hover:bg-card/70 sm:flex-row sm:items-center"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-500 text-sm font-bold text-white shadow-sm">
                  {team.anonymousIndex != null
                    ? `T${team.anonymousIndex}`
                    : team.teamName.match(/^Team\s+(\d+)$/i)
                      ? `T${team.teamName.match(/^Team\s+(\d+)$/i)![1]}`
                      : "T?"}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{team.teamName}</span>

                    <Badge
                      variant="outline"
                      className="h-5 border-border bg-background/40 text-[10px]"
                    >
                      {team.track?.name}
                    </Badge>

                    <Badge
                      variant="outline"
                      className="h-5 border-border bg-background/40 text-[10px]"
                    >
                      {team.roundName}
                    </Badge>

                    <Badge 
                      variant="outline" 
                      className={`h-5 border-border ml-auto font-mono text-[11px] ${team.weightedScore != null ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-background/40 text-muted-foreground'}`}
                    >
                      Score: {team.weightedScore != null ? `${Number(team.weightedScore).toFixed(1)}/10` : '_/?'}
                    </Badge>
                  </div>

                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className={statusLabel === "Completed" ? "text-green-500 font-medium" : "text-orange-400 font-medium"}>
                      ● {statusLabel}
                    </span>
                    <span className="truncate">{team.eventName}</span>
                    {team.submittedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(team.submittedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <Link href={href}>
                  <Button className="shrink-0 border-0 text-white bg-primary hover:opacity-90">
                    Review Submission
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
