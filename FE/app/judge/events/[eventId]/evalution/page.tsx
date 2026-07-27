"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { PanelLeftOpen, Loader2, AlertCircle } from "lucide-react";
import { useSnackbar } from "notistack";

import { TeamListPanel } from "./components/team-list-pannel";
import { TeamSelectorBar } from "./components/team-selector-bar";
import { TeamHeader } from "./components/team-header";
import { RoundTabs } from "./components/round-tabs";
import { SubmissionContentCard } from "./components/submission-content-card";
import { CriteriaScoring } from "./components/criteria-score";
import { ScoreSummary } from "./components/score-summary";
import { GlassCard } from "@/components/ui/glass-card";
import {
  judgeApi,
  type JudgeRubric,
} from "@/lib/api/judge.api";

function buildScoreState(
  rubrics: JudgeRubric[],
  myScores: Array<{ criterionId: number; scoreValue: number | string; comment?: string | null }>,
) {
  const scores: Record<number, number> = {};
  const comments: Record<number, string> = {};

  rubrics.forEach((rubric) => {
    scores[rubric.id] = 0;
    comments[rubric.id] = "";
  });

  myScores.forEach((entry) => {
    scores[entry.criterionId] = Number(entry.scoreValue);
    comments[entry.criterionId] = entry.comment ?? "";
  });

  return { scores, comments };
}

export default function EvaluationPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [topbarElement, setTopbarElement] = useState<Element | null>(null);

  useEffect(() => {
    setTopbarElement(document.getElementById("topbar-center-content"));
  }, []);

  const [collapsed, setCollapsed] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});

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
    router.replace(`/judge/events/${selectedEvent.id}/evalution?${urlParams.toString()}`, { scroll: false });
  }, [selectedEvent, selectedRoundId, eventIdParam, roundIdParam, router]);

  const {
    data: roundSubmissions = [],
    isLoading: submissionsLoading,
  } = useQuery({
    queryKey: ["judge", "round-submissions", selectedRoundId],
    queryFn: () => judgeApi.getRoundSubmissions(selectedRoundId!),
    enabled: !!selectedRoundId,
  });

  useEffect(() => {
    if (!roundSubmissions.length) {
      setSelectedSubmissionId(null);
      return;
    }
    const exists = roundSubmissions.some(
      (s) => (s.submissionId ?? s.id) === selectedSubmissionId,
    );
    if (!selectedSubmissionId || !exists) {
      setSelectedSubmissionId(roundSubmissions[0].submissionId ?? roundSubmissions[0].id);
    }
  }, [roundSubmissions, selectedSubmissionId]);

  const {
    data: submissionDetail,
    isLoading: detailLoading,
  } = useQuery({
    queryKey: ["judge", "submission", selectedSubmissionId],
    queryFn: () => judgeApi.getSubmissionDetail(selectedSubmissionId!),
    enabled: !!selectedSubmissionId,
  });

  useEffect(() => {
    if (!submissionDetail) return;
    const next = buildScoreState(submissionDetail.rubrics, submissionDetail.myScores);
    
    if (selectedSubmissionId) {
      try {
        const draftKey = `judge_draft_${selectedSubmissionId}`;
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          setScores(parsed.scores || next.scores);
          setComments(parsed.comments || next.comments);
          return;
        }
      } catch (e) {
        console.error("Failed to load draft", e);
      }
    }

    setScores(next.scores);
    setComments(next.comments);
  }, [submissionDetail, selectedSubmissionId]);

  const handleSaveDraft = useCallback(() => {
    if (!selectedSubmissionId) return;
    const draftKey = `judge_draft_${selectedSubmissionId}`;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ scores, comments }));
      enqueueSnackbar("Draft saved locally", { variant: "info" });
    } catch (e) {
      enqueueSnackbar("Failed to save draft", { variant: "error" });
    }
  }, [selectedSubmissionId, scores, comments, enqueueSnackbar]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSubmissionId || !submissionDetail) {
        throw new Error("No submission selected");
      }

      const payload = {
        scores: submissionDetail.rubrics.map((rubric) => {
          return {
            criterionId: rubric.id,
            scoreValue: scores[rubric.id] ?? 0,
            comment: comments[rubric.id]?.trim() || undefined,
          };
        }),
      };

      return judgeApi.submitScores(selectedSubmissionId, payload);
    },
    onSuccess: (data) => {
      if (selectedSubmissionId) {
        localStorage.removeItem(`judge_draft_${selectedSubmissionId}`);
      }
      enqueueSnackbar("Scores submitted successfully", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["judge", "submission", selectedSubmissionId] });
      queryClient.invalidateQueries({ queryKey: ["judge", "round-submissions", selectedRoundId] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to save scores";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const handleSelectRound = useCallback(
    (roundId: number) => {
      if (!selectedEvent) return;
      const urlParams = new URLSearchParams();
      urlParams.set("roundId", String(roundId));
      router.replace(`/judge/events/${selectedEvent.id}/evalution?${urlParams.toString()}`);
      setSelectedSubmissionId(null);
    },
    [router, selectedEvent],
  );

  const roundStatus = submissionDetail?.round.status;
  const submissionDeadline = submissionDetail?.round.submissionDeadline;
  const scoringLocked =
    !roundStatus ||
    roundStatus === "results_published" ||
    roundStatus === "not_started" ||
    (roundStatus === "open" &&
      (!submissionDeadline || new Date(submissionDeadline) > new Date()));

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
            Evaluation
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedEvent?.name}</span>
            <span>—</span>
            {selectedRound && (
              <>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  roundStatus === "open"
                    ? "bg-blue-500/10 text-blue-500"
                    : roundStatus === "results_published"
                    ? "bg-purple-500/10 text-purple-500"
                    : (roundStatus === "closed" || roundStatus === "judging")
                    ? "bg-orange-500/10 text-orange-500"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {roundStatus?.replace("_", " ") || "unknown"}
                </span>
                
                {submissionDeadline && (
                  <span className="flex items-center gap-1.5 opacity-80">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Deadline: {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(submissionDeadline))}
                  </span>
                )}
              </>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground/80">
            Select a round and a team to start scoring.
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

      <TeamSelectorBar
        teams={roundSubmissions}
        selectedSubmissionId={selectedSubmissionId}
        onSelectSubmission={setSelectedSubmissionId}
        isLoading={submissionsLoading}
      />

      <div className="mt-2 flex h-[calc(100vh-220px)] gap-5 overflow-hidden">
        <TeamListPanel
          teams={roundSubmissions}
          selectedSubmissionId={selectedSubmissionId}
          onSelectSubmission={setSelectedSubmissionId}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          isLoading={submissionsLoading}
        />

        <main className="flex-1 overflow-y-auto pr-2">
          {collapsed && (
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              type="button"
              onClick={() => setCollapsed(false)}
              className="mb-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-card/40 px-5 py-3 hover:border-orange-500/40 hover:bg-orange-500/10"
            >
              <PanelLeftOpen size={16} />
              Show teams
            </motion.button>
          )}

          {detailLoading && selectedSubmissionId ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : (
            <>
              <TeamHeader
                detail={submissionDetail}
                roundName={selectedRound?.roundName}
              />

              <div className="mt-8 space-y-8">
                <SubmissionContentCard detail={submissionDetail} />
                <div className="mt-8">
                  <h2 className="mb-6 text-3xl font-bold">Rubric Evaluation</h2>
                  
                  {scoringLocked && (
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-500">
                      <AlertCircle className="h-5 w-5 shrink-0" />
                      <div>
                        <h4 className="font-semibold text-sm">Scoring is currently locked</h4>
                        <p className="mt-1 text-xs opacity-90">
                          {roundStatus === "not_started" && "The round has not started yet."}
                          {roundStatus === "results_published" && "Results for this round have been published. Scores cannot be changed."}
                          {roundStatus === "open" && "Submissions are still open. Judges can only score when the deadline has passed or the round is Closed/Judging."}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-8 xl:grid-cols-12">
                    <div className="xl:col-span-8">
                      <CriteriaScoring
                        rubrics={submissionDetail?.rubrics ?? []}
                        scores={scores}
                        comments={comments}
                        disabled={scoringLocked || saveMutation.isPending}
                        onScoreChange={(id, value) =>
                          setScores((prev) => ({ ...prev, [id]: value }))
                        }
                        onCommentChange={(id, value) =>
                          setComments((prev) => ({ ...prev, [id]: value }))
                        }
                      />
                    </div>

                    <div className="xl:col-span-4">
                      <ScoreSummary
                        rubrics={submissionDetail?.rubrics ?? []}
                        scores={scores}
                        scoringStatus={submissionDetail?.scoringStatus}
                        weightedScore={submissionDetail?.weightedScore}
                        isSaving={saveMutation.isPending}
                        disabled={scoringLocked}
                        onSaveDraft={handleSaveDraft}
                        onSubmit={() => saveMutation.mutate()}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
