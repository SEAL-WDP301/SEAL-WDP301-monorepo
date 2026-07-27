"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { axiosClient } from "@/lib/axios";
import { useJudgeWorkspace } from "@/lib/hooks/use-judge-workspace";

import { useParams } from "next/navigation";

export function JudgeDashboardHeader() {
  const params = useParams();
  const { data: user } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await axiosClient.get("/users/profile");
      return res.data?.data as { name?: string } | null;
    },
  });

  const { stats, isLoading } = useJudgeWorkspace(params.eventId as string);

  if (isLoading) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    );
  }

  const name = user?.name?.split(" ")[0] ?? "Judge";

  return (
    <div>
      <h1 className="mt-3 text-5xl font-bold tracking-tight text-muted-foreground">
        Welcome back, {name}
      </h1>

      <p className="mt-2 text-sm text-muted-foreground">
        {stats.pendingReviews > 0
          ? `You have ${stats.pendingReviews} pending evaluation${stats.pendingReviews > 1 ? "s" : ""} across ${stats.openRoundCount} open round${stats.openRoundCount !== 1 ? "s" : ""}.`
          : stats.assignedTeams > 0
            ? `All ${stats.completedReviews} scored submission${stats.completedReviews !== 1 ? "s are" : " is"} complete for now.`
            : "No team submissions assigned to you yet — check back after teams submit."}
      </p>
    </div>
  );
}
