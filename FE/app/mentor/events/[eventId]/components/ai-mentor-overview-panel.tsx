"use client";

import Link from "next/link";
import { Info, Loader2, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import type { MentorAiOverviewResult } from "@/lib/api/mentor.api";

interface Props {
  eventId: string;
  overview: MentorAiOverviewResult | null;
  isLoading?: boolean;
  onGenerate?: () => void;
}

function priorityClass(priority: "high" | "medium" | "low") {
  if (priority === "high") return "bg-red-500/10 text-red-400 border-red-500/30";
  if (priority === "medium")
    return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
}

function readinessLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function AiMentorOverviewPanel({
  eventId,
  overview,
  isLoading,
  onGenerate,
}: Props) {
  return (
    <GlassCard className="rounded-[24px] bg-card p-6 space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-semibold">AI Mentoring Overview</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Triage all assigned teams when the list gets large — see who needs
            attention first, then open a team to draft feedback.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={isLoading || !onGenerate}
          onClick={onGenerate}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {overview ? "Refresh overview" : "Generate overview"}
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 text-sm text-orange-100">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
        <div className="space-y-1">
          <p className="font-medium text-orange-300">
            Assist only — mentor decides
          </p>
          <p className="text-xs leading-relaxed text-orange-100/80">
            This ranks teams for mentoring focus. It does not score teams or
            send feedback. Always verify before acting.
          </p>
        </div>
      </div>

      {isLoading && !overview && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
          Building portfolio triage across your assigned teams…
        </div>
      )}

      {overview && (
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-foreground">
            {overview.summary}
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Teams", value: overview.stats.totalTeams },
              { label: "Submitted", value: overview.stats.withSubmission },
              { label: "Need feedback", value: overview.stats.missingFeedback },
              { label: "High priority", value: overview.stats.highPriority },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border bg-muted/30 p-4"
              >
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {overview.priorityTeams.map((team) => (
              <div
                key={team.teamId}
                className="rounded-2xl border border-border bg-muted/20 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{team.teamName}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityClass(team.priority)}`}
                      >
                        {team.priority}
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {readinessLabel(team.readiness)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {team.trackName || "No track"}
                      {team.latestRoundName
                        ? ` · ${team.latestRoundName}`
                        : " · No submission"}
                      {team.unreadChatCount > 0
                        ? ` · ${team.unreadChatCount} unread`
                        : ""}
                    </p>
                  </div>
                  <Button asChild variant="orange" size="sm" className="rounded-xl">
                    <Link href={`/mentor/events/${eventId}/teams/${team.teamId}`}>
                      Open team
                    </Link>
                  </Button>
                </div>
                <p className="mt-3 text-sm">{team.reason}</p>
                <p className="mt-1 text-sm text-orange-400">
                  Focus: {team.focus}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
