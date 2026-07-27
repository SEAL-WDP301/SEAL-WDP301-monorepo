"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { Star, AlertCircle, Loader2, Trophy, ChevronDown, ChevronUp } from "lucide-react";
import { useSnackbar } from "notistack";
import { motion, AnimatePresence } from "framer-motion";

import { judgeApi } from "@/lib/api/judge.api";
import { GlassCard } from "@/components/ui/glass-card";
import { RoundTabs } from "../evalution/components/round-tabs";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function LeaderboardRow({ sub, index, handleVote, toggleVoteMutation }: any) {
  const [isExpanded, setIsExpanded] = useState(false);
  const submissionId = sub.submissionId ?? sub.id;
  const isCompleted = sub.scoringStatus === "completed";

  const { data: detail, isLoading } = useQuery({
    queryKey: ["judge", "submission-detail", submissionId],
    queryFn: () => judgeApi.getSubmissionDetail(submissionId),
    enabled: isExpanded,
  });

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
        <TableCell className="text-center font-medium">
          #{index + 1}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{sub.teamName}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </TableCell>
        <TableCell>
          <span className="inline-flex items-center rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-0.5 text-xs font-medium text-orange-500">
            {sub.track.name}
          </span>
        </TableCell>
        <TableCell className="text-center">
          <span className={cn(
            "text-xs font-medium uppercase tracking-wider",
            isCompleted ? "text-green-500" : "text-muted-foreground"
          )}>
            {isCompleted ? "Completed" : "Pending"}
          </span>
        </TableCell>
        <TableCell className="text-right font-medium">
          {sub.weightedScore !== null && sub.weightedScore !== undefined 
            ? sub.weightedScore 
            : "-"}
        </TableCell>
        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                className={cn(
                  "inline-flex shrink-0 items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden",
                  "h-9 w-9",
                  sub.isVotedByMe
                    ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 hover:text-orange-400"
                    : "text-muted-foreground hover:bg-white/10 hover:text-foreground",
                  !isCompleted && "opacity-40"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isCompleted) return;
                  handleVote(submissionId, sub.scoringStatus);
                }}
                disabled={toggleVoteMutation.isPending}
              >
                <Star className={cn("h-5 w-5", sub.isVotedByMe && "fill-current")} />
              </TooltipTrigger>
              {!isCompleted && (
                <TooltipContent>
                  <p>You must finish scoring to vote</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </TableCell>
      </TableRow>
      <AnimatePresence>
        {isExpanded && (
          <TableRow className="hover:bg-transparent border-0">
            <TableCell colSpan={6} className="p-0 border-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-muted/20"
              >
                <div className="p-4 px-6">
                  {isLoading ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : detail ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {detail.rubrics.map((rubric: any) => {
                        const score = detail.myScores.find((s: any) => s.criterionId === rubric.id);
                        return (
                          <div key={rubric.id} className="bg-background rounded-lg p-3 border border-border">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="text-sm font-semibold text-foreground pr-2" title={rubric.name}>
                                {rubric.name}
                              </h4>
                              <span className="text-sm font-bold bg-muted px-2 py-0.5 rounded-full shrink-0 tabular-nums">
                                {score ? score.scoreValue : "-"} <span className="text-[10px] text-muted-foreground font-normal">/ {rubric.maxScore}</span>
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-muted-foreground mt-2">
                              <span>Weight: {rubric.weight}</span>
                              {score?.comment && (
                                <span className="italic line-clamp-1 max-w-[150px]" title={score.comment}>
                                  &ldquo;{score.comment}&rdquo;
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center">Failed to load details</div>
                  )}
                </div>
              </motion.div>
            </TableCell>
          </TableRow>
        )}
      </AnimatePresence>
    </>
  );
}

export default function LeaderboardPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [topbarElement, setTopbarElement] = useState<Element | null>(null);

  useEffect(() => {
    setTopbarElement(document.getElementById("topbar-center-content"));
  }, []);

  const eventIdParam = params.eventId as string;
  const roundIdParam = searchParams.get("roundId");

  const { data: assignedEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["judge", "events"],
    queryFn: judgeApi.getAssignedEvents,
  });

  const selectedEvent = useMemo(() => {
    if (!assignedEvents.length) return null;
    if (eventIdParam) {
      return assignedEvents.find((e) => e.id === Number(eventIdParam)) ?? assignedEvents[0];
    }
    return assignedEvents[0];
  }, [assignedEvents, eventIdParam]);

  const eventRounds = selectedEvent?.rounds ?? [];

  const selectedRoundId = useMemo(() => {
    if (roundIdParam) {
      const parsed = Number(roundIdParam);
      if (eventRounds.some((r) => r.roundId === parsed)) return parsed;
    }
    return eventRounds[0]?.roundId ?? null;
  }, [eventRounds, roundIdParam]);

  const selectedRound = eventRounds.find((r) => r.roundId === selectedRoundId);

  useEffect(() => {
    if (!selectedEvent || !selectedRoundId) return;
    if (
      eventIdParam === String(selectedEvent.id) &&
      roundIdParam === String(selectedRoundId)
    ) {
      return;
    }
    const urlParams = new URLSearchParams();
    urlParams.set("roundId", String(selectedRoundId));
    router.replace(`/judge/events/${selectedEvent.id}/leaderboard?${urlParams.toString()}`, { scroll: false });
  }, [selectedEvent, selectedRoundId, eventIdParam, roundIdParam, router]);

  const {
    data: roundSubmissions = [],
    isLoading: submissionsLoading,
  } = useQuery({
    queryKey: ["judge", "round-submissions", selectedRoundId],
    queryFn: () => judgeApi.getRoundSubmissions(selectedRoundId!),
    enabled: !!selectedRoundId,
  });

  const handleSelectRound = useCallback(
    (roundId: number) => {
      if (!selectedEvent) return;
      const urlParams = new URLSearchParams();
      urlParams.set("roundId", String(roundId));
      router.replace(`/judge/events/${selectedEvent.id}/leaderboard?${urlParams.toString()}`);
    },
    [router, selectedEvent],
  );

  const toggleVoteMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      return judgeApi.toggleVote(submissionId);
    },
    onMutate: async (submissionId) => {
      await queryClient.cancelQueries({ queryKey: ["judge", "round-submissions", selectedRoundId] });

      const previousSubmissions = queryClient.getQueryData(["judge", "round-submissions", selectedRoundId]);

      queryClient.setQueryData(["judge", "round-submissions", selectedRoundId], (old: any) => {
        if (!old) return old;
        return old.map((sub: any) => {
          if ((sub.submissionId ?? sub.id) === submissionId) {
            return { ...sub, isVotedByMe: !sub.isVotedByMe };
          }
          return sub;
        });
      });

      return { previousSubmissions };
    },
    onError: (err: any, submissionId, context) => {
      queryClient.setQueryData(
        ["judge", "round-submissions", selectedRoundId],
        context?.previousSubmissions
      );
      enqueueSnackbar(err?.response?.data?.message || "Failed to toggle vote", { variant: "error" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["judge", "round-submissions", selectedRoundId] });
    },
  });

  const handleVote = (submissionId: number, scoringStatus: string) => {
    if (scoringStatus !== "completed") {
      enqueueSnackbar("You must complete scoring for this submission before voting", { variant: "warning" });
      return;
    }
    toggleVoteMutation.mutate(submissionId);
  };

  const tracks = useMemo(() => {
    const trackMap = new Map<number, string>();
    roundSubmissions.forEach(sub => {
      trackMap.set(sub.track.id, sub.track.name);
    });
    return Array.from(trackMap.entries()).map(([id, name]) => ({ id, name }));
  }, [roundSubmissions]);

  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);

  useEffect(() => {
    setSelectedTrackId(null);
  }, [selectedRoundId]);

  const sortedSubmissions = useMemo(() => {
    let filtered = roundSubmissions;
    if (selectedTrackId !== null) {
      filtered = filtered.filter(sub => sub.track.id === selectedTrackId);
    }
    return [...filtered].sort((a, b) => {
      const scoreA = a.weightedScore ?? 0;
      const scoreB = b.weightedScore ?? 0;
      return scoreB - scoreA;
    });
  }, [roundSubmissions, selectedTrackId]);

  if (eventsLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!assignedEvents.length) {
    return (
      <GlassCard className="p-10 text-center">
        <AlertCircle className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No assigned events</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You have not been assigned as a judge for any events.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="shrink-0">
          <h1 className="mt-3 text-5xl font-bold tracking-tight text-foreground">
            Leaderboard
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedEvent?.name}</span>
            <span>—</span>
            {selectedRound && (
              <span className="font-medium">{selectedRound.roundName}</span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground/80">
            Vote for the best submissions. You can only vote for submissions you have finished scoring.
          </p>
        </div>

        {topbarElement && createPortal(
          <RoundTabs
            rounds={eventRounds}
            selectedRoundId={selectedRoundId}
            onSelectRound={handleSelectRound}
          />,
          topbarElement
        )}
      </div>

      <GlassCard className="overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 bg-white/5 px-6 py-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-orange-500" />
            <h2 className="font-semibold text-lg">Submissions</h2>
          </div>
          
          {tracks.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setSelectedTrackId(null)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                  selectedTrackId === null
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                All Tracks
              </button>
              {tracks.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTrackId(t.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    selectedTrackId === t.id
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {submissionsLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : sortedSubmissions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No submissions available for this round.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 text-center">Rank</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Track</TableHead>
                  <TableHead className="text-center">Scoring Status</TableHead>
                  <TableHead className="text-right">Your Score</TableHead>
                  <TableHead className="w-32 text-center">Vote</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSubmissions.map((sub, index) => (
                  <LeaderboardRow
                    key={sub.submissionId ?? sub.id}
                    sub={sub}
                    index={index}
                    handleVote={handleVote}
                    toggleVoteMutation={toggleVoteMutation}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
