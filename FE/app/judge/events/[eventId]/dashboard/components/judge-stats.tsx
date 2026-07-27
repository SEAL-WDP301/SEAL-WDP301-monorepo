"use client";

import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  Users,
  Loader2,
} from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { useJudgeWorkspace } from "@/lib/hooks/use-judge-workspace";
import { useParams } from "next/navigation";

export function JudgeStats() {
  const params = useParams();
  const { stats, isLoading } = useJudgeWorkspace(params.eventId as string);

  const nearestDeadline = stats.nearestSubmissionDeadline
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(stats.nearestSubmissionDeadline))
    : "—";

  const items = [
    {
      icon: Users,
      label: "Assigned Submissions",
      value: stats.assignedTeams,
    },
    {
      icon: ClipboardCheck,
      label: "Not Started",
      value: stats.pendingReviews,
    },
    {
      icon: ListChecks,
      label: "In Progress",
      value: stats.inReviewReviews,
    },
    {
      icon: CheckCircle2,
      label: "All Criteria Scored",
      value: stats.completedReviews,
    },
    {
      icon: CalendarClock,
      label: "Nearest Submission Deadline",
      value: nearestDeadline,
      compact: true,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <GlassCard key={item.label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>

                <div className="mt-2 flex items-end gap-1">
                  <h3 className={item.compact ? "text-lg font-bold" : "text-3xl font-bold"}>
                    {item.value}
                  </h3>

                </div>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
