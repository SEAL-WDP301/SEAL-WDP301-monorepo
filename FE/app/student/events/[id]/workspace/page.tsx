"use client";

import { motion } from "framer-motion";
import {
  Clock,
  CheckCircle2,
  Upload,
  MessageSquare,
  Award,
  ChevronRight,
  ChevronLeft,
  Target,
  Zap,
  Loader2,
  Crown,
  ScrollText,
  FileText,
  ShieldCheck,
  XCircle,
  Trophy,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "@/lib/api/workspace.api";
import { getStudentOnlineMeeting } from "@/lib/api/student-events.api";
import { getPublicEvent } from "@/lib/api/public-events.api";
import { OnlineMeetingCard } from "@/components/events/online-meeting-card";
import { useEffect, useMemo, useState } from "react";
import { TeamRoundStatusBanner } from "@/components/student/team-round-status-banner";
import { ProblemStatementViewer } from "@/components/problem/problem-statement-viewer";

interface WorkspaceRound {
  id: number;
  name: string;
  roundNumber: number;
  status: string;
  submissionDeadline?: string | null;
}

interface WorkspaceRoundSubmission {
  round: WorkspaceRound;
  teamRound: {
    status: string;
    score?: unknown;
  } | null;
  submission?: unknown | null;
  canSubmit?: boolean;
}

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    if (!targetDate) return;
    const interval = setInterval(() => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0 });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

export default function WorkspaceOverviewPage() {
  const params = useParams();
  const eventId = params.id as string;
  const basePath = `/student/events/${eventId}/workspace`;
  const router = useRouter();
  const searchParams = useSearchParams();
  const roundIdParam = searchParams.get("roundId");
  const selectedRoundId = roundIdParam ? Number(roundIdParam) : null;

  const { data, isLoading } = useQuery({
    queryKey: ["workspace", eventId],
    queryFn: () => workspaceApi.getWorkspaceOverview(Number(eventId)),
  });

  const { data: onlineMeeting } = useQuery({
    queryKey: ["studentOnlineMeeting", eventId],
    queryFn: () => getStudentOnlineMeeting(eventId),
    retry: false,
  });

  const { data: publicEvent } = useQuery({
    queryKey: ["publicEvent", eventId],
    queryFn: () => getPublicEvent(eventId),
    retry: false,
  });

  const workspaceData = data?.data;
  const isLeader = workspaceData?.role === "leader";
  const currentActiveRound = workspaceData?.currentActiveRound;
  const rounds: WorkspaceRound[] = workspaceData?.rounds || [];
  const roundSubmissions: WorkspaceRoundSubmission[] = useMemo(
    () => workspaceData?.roundSubmissions || [],
    [workspaceData?.roundSubmissions]
  );
  const timeLeft = useCountdown(currentActiveRound?.submissionDeadline || null);

  // ── Auto-redirect to correct roundId ──────────────────────────────────────
  useEffect(() => {
    if (!workspaceData || selectedRoundId) return;

    // Priority: competing → last participated → first round
    const competingEntry = roundSubmissions.find(
      (rs: any) => rs.teamRound?.status === "competing"
    );
    const participatedEntries = roundSubmissions.filter(
      (rs: any) => rs.teamRound !== null
    );
    const lastParticipated = participatedEntries[participatedEntries.length - 1];
    const firstEntry = roundSubmissions[0];

    const target = competingEntry || lastParticipated || firstEntry;
    if (target) {
      router.replace(`${basePath}?roundId=${target.round.id}`);
    }
  }, [workspaceData, selectedRoundId, router, basePath, roundSubmissions]);

  // ── Progress Line (team-level, not event-level) ───────────────────────────
  const eliminatedRoundIdx = roundSubmissions.findIndex(
    (rs: any) => rs.teamRound?.status === "eliminated"
  );
  const isEliminated = eliminatedRoundIdx >= 0;

  const lastParticipatedIdx = roundSubmissions.reduce(
    (lastIdx: number, rs: any, idx: number) =>
      rs.teamRound !== null ? idx : lastIdx,
    -1
  );

  const isFinalRoundCompleted = rounds.length > 0 && (
    (rounds[rounds.length - 1]?.status === "results_published" || workspaceData?.eventStatus === "closed" || workspaceData?.event?.status === "closed") &&
    !isEliminated
  );

  const progressWidth = useMemo(() => {
    if (!rounds || rounds.length === 0) return 0;
    if (isEliminated) {
      return ((eliminatedRoundIdx + 0.5) / rounds.length) * 100;
    }
    if (isFinalRoundCompleted) {
      return 100;
    }
    if (lastParticipatedIdx >= 0) {
      const lastRs = roundSubmissions[lastParticipatedIdx];
      const lastStatus = lastRs?.round?.status;
      const isDone = lastStatus === "closed" || lastStatus === "results_published";
      const extra = isDone ? 1.0 : 0.5;
      return Math.min(100, ((lastParticipatedIdx + extra) / rounds.length) * 100);
    }
    return 0;
  }, [rounds, isEliminated, eliminatedRoundIdx, isFinalRoundCompleted, lastParticipatedIdx, roundSubmissions]);

  // ── Prev / Next round navigation ──────────────────────────────────────────
  const selectedIdx = rounds.findIndex((r) => r.id === selectedRoundId);
  const prevRound = selectedIdx > 0 ? rounds[selectedIdx - 1] : null;
  
  let nextRound = null;
  if (selectedIdx < rounds.length - 1) {
    const nextCandidate = rounds[selectedIdx + 1];
    const hasAccess = roundSubmissions.some((rs: any) => rs.round.id === nextCandidate.id && rs.teamRound !== null);
    if (hasAccess) {
      nextRound = nextCandidate;
    }
  }

  // ── Show the active round card based on selected round context ─────────────
  const selectedRoundEntry = selectedRoundId
    ? roundSubmissions.find((rs: any) => rs.round.id === selectedRoundId)
    : null;
  const displayRound = selectedRoundEntry?.round ?? currentActiveRound;
  const canSubmitSelected = selectedRoundEntry?.canSubmit ?? false;

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-8 animate-in fade-in duration-500">
      {/* Award Winner Celebration Banner when event is closed */}
      {(workspaceData?.eventStatus === "closed" || workspaceData?.event?.status === "closed") && (workspaceData?.team?.award || workspaceData?.team?.awardId) && (
        <GlassCard className="p-6 rounded-[24px] bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-orange-500/20 border-2 border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center shrink-0">
                <Trophy className="h-9 w-9 text-yellow-500 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">Official Award Winner</span>
                </div>
                <h2 className="text-2xl font-extrabold text-foreground">
                  🎉 Congratulations! Your team won {workspaceData.team.award?.name || "an Official Award"}!
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {workspaceData.team.award?.description || "Outstanding performance in this competition!"}
                </p>
              </div>
            </div>
            <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600 text-black font-extrabold text-sm px-4 py-2 rounded-xl shrink-0">
              🏆 {workspaceData.team.award?.name || "Award Winner"}
            </Badge>
          </div>
        </GlassCard>
      )}

      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          {displayRound ? (
            <Badge variant="outline" className="mb-3 border-orange-500/30 text-orange-400 bg-orange-500/10">
              {displayRound.name}
            </Badge>
          ) : (
            <Badge variant="outline" className="mb-3 border-zinc-500/30 text-zinc-400 bg-zinc-500/10">
              No Active Phase
            </Badge>
          )}
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Workspace Overview
          </h1>
          <p className="mt-2 text-muted-foreground">
            Track your progress, deadlines, and team performance all in one place.
          </p>
        </div>
      </header>

      <OnlineMeetingCard
        meeting={onlineMeeting || publicEvent?.calendarMeeting}
        eventStatus={publicEvent?.status}
      />

      {/* ── Team Round Status Banner (Overview Context) ── */}
      {selectedRoundEntry && (
        <TeamRoundStatusBanner
          roundName={selectedRoundEntry.round?.name}
          roundStatus={selectedRoundEntry.round?.status}
          teamRoundStatus={selectedRoundEntry.teamRound?.status}
          score={selectedRoundEntry.teamRound?.score}
          isFinalRound={selectedIdx === rounds.length - 1}
          eventStatus={workspaceData?.eventStatus || workspaceData?.event?.status}
          award={(selectedRoundEntry as any)?.award || workspaceData?.team?.award}
          nextRoundId={nextRound?.id}
          nextRoundName={nextRound?.name}
          basePath={basePath}
          isOverview={true}
        />
      )}

      {/* ── Competition Journey ── */}
      <section>
        <GlassCard className="p-6 md:p-8 rounded-[24px] bg-card border-border relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-orange-500/10 blur-[100px] rounded-full pointer-events-none" />

          <h2 className="text-lg font-semibold mb-8 flex items-center gap-2">
            <Target className="h-5 w-5 text-orange-500" />
            Competition Journey
          </h2>

          <div className="relative">
            {/* Base line */}
            <div className="absolute top-[24px] left-0 w-full h-1 bg-border -translate-y-1/2 rounded-full hidden md:block" />
            {/* Progress line — team-level */}
            <div
              className={`absolute top-[24px] left-0 h-1 -translate-y-1/2 rounded-full hidden md:block transition-all duration-1000 ease-out ${
                isEliminated ? "bg-red-500" : "bg-orange-500"
              }`}
              style={{ width: `${progressWidth}%` }}
            />

            <div className={`grid grid-cols-1 md:grid-cols-${Math.max(1, rounds.length)} gap-6 relative z-10`}>
              {rounds.map((round, index) => {
                const rs = roundSubmissions.find((e: any) => e.round.id === round.id);
                const teamRoundStatus = rs?.teamRound?.status ?? null;
                const isEliminatedHere = teamRoundStatus === "eliminated";
                const isAdvanced = teamRoundStatus === "advanced";
                const isCompeting = teamRoundStatus === "competing";
                const isParticipated = rs?.teamRound !== null;
                const isAfterEliminated = isEliminated && index > eliminatedRoundIdx;
                const isFinalRound = index === rounds.length - 1;
                const isSelected = round.id === selectedRoundId;
                const isActive = round.status === "open" && isCompeting;
                const isCompleted =
                  (round.status === "closed" || round.status === "results_published") &&
                  isParticipated;

                // Node color
                const nodeClass = isEliminatedHere
                  ? "bg-red-500/20 border-2 border-red-500 text-red-500 ring-4 ring-red-500/20"
                  : isAfterEliminated
                  ? "bg-muted border border-border text-muted-foreground/30 cursor-not-allowed"
                  : isFinalRound
                  ? isCompleted
                    ? "bg-gradient-to-tr from-orange-500 to-yellow-400 text-white ring-4 ring-yellow-500/40 scale-110 shadow-[0_0_20px_rgba(234,179,8,0.4)]"
                    : isActive
                    ? "bg-background border-2 border-yellow-500 text-yellow-600 ring-4 ring-yellow-500/20 scale-110 shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                    : "bg-muted border-2 border-yellow-500/30 text-muted-foreground"
                  : isCompleted || isAdvanced
                  ? "bg-orange-500 text-white"
                  : isActive
                  ? "bg-background border-2 border-orange-500 text-orange-500 shadow-[0_0_20px_rgba(243,112,33,0.4)]"
                  : "bg-muted border border-border text-muted-foreground";

                const labelClass = isEliminatedHere
                  ? "text-red-500 font-semibold"
                  : isAfterEliminated
                  ? "text-muted-foreground/30"
                  : isFinalRound && (isActive || isCompleted)
                  ? "text-yellow-600 dark:text-yellow-500 font-semibold"
                  : isActive
                  ? "text-orange-400 font-semibold"
                  : isCompleted || isAdvanced
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground";

                const canAccessRound = isParticipated && !isAfterEliminated;
                const NodeWrapper = canAccessRound ? Link : "div";
                const nodeProps = canAccessRound
                  ? { href: `${basePath}?roundId=${round.id}` }
                  : {};

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    key={round.id}
                    className="flex flex-col items-center text-center"
                  >
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <NodeWrapper {...(nodeProps as any)} className="relative mb-4 block group">
                      {/* Selected ring */}
                      {isSelected && !isAfterEliminated && (
                        <div className="absolute -inset-2 rounded-full border-2 border-orange-500/50 z-20 pointer-events-none" />
                      )}
                      {/* Active pulse */}
                      {isActive && !isEliminatedHere && (
                        <div
                          className={`absolute inset-0 rounded-full animate-ping z-0 opacity-75 ${
                            isFinalRound ? "bg-yellow-500" : "bg-orange-500"
                          }`}
                          style={{ animationDuration: "2s" }}
                        />
                      )}
                      {/* Crown for final */}
                      {isFinalRound && (
                        <motion.div
                          initial={{ opacity: 0, rotate: -45, y: 10 }}
                          animate={{ opacity: 1, rotate: 15, y: 0 }}
                          transition={{ delay: index * 0.1 + 0.3, type: "spring" }}
                          className="absolute -top-4 -right-3 z-20"
                        >
                          <Crown
                            className={`h-6 w-6 ${
                              isCompleted
                                ? "text-yellow-400 drop-shadow-[0_2px_10px_rgba(250,204,21,0.8)]"
                                : isActive
                                ? "text-yellow-500/80 drop-shadow-sm"
                                : "text-yellow-500/30"
                            }`}
                            fill="currentColor"
                          />
                        </motion.div>
                      )}
                      {/* Circle */}
                      <div
                        className={`h-12 w-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg relative z-10 ${nodeClass} ${
                          !isAfterEliminated ? "group-hover:scale-105" : ""
                        }`}
                      >
                        {isEliminatedHere ? (
                          <XCircle className="h-6 w-6" />
                        ) : isCompleted || isAdvanced ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : (
                          <span className="font-bold text-lg">{round.roundNumber}</span>
                        )}
                      </div>
                    </NodeWrapper>

                    <h3 className={`text-sm ${labelClass}`}>{round.name}</h3>
                    {isEliminatedHere && (
                      <span className="text-[10px] text-red-400 font-medium">Eliminated</span>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 font-medium">
                      {round.submissionDeadline
                        ? new Date(round.submissionDeadline).toLocaleDateString()
                        : "TBA"}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Prev / Next navigation */}
          {rounds.length > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              {prevRound ? (
                <Link href={`${basePath}?roundId=${prevRound.id}`}>
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-4 w-4" />
                    {prevRound.name}
                  </Button>
                </Link>
              ) : (
                <div />
              )}
              {selectedRoundId && (
                <span className="text-xs text-muted-foreground">
                  Viewing: <span className="font-semibold text-foreground">
                    {rounds.find((r) => r.id === selectedRoundId)?.name}
                  </span>
                </span>
              )}
              {nextRound ? (
                <Link href={`${basePath}?roundId=${nextRound.id}`}>
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                    {nextRound.name}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <div />
              )}
            </div>
          )}
        </GlassCard>
      </section>

      {displayRound?.trackPending && (
        <GlassCard className="p-5 rounded-[24px] border-amber-500/30 bg-amber-500/5 text-sm text-muted-foreground">
          Track / Problem Statement has not been published yet. Please wait for organizers to open the round.
        </GlassCard>
      )}

      {displayRound?.problemFileUrl && (
        <ProblemStatementViewer
          fileUrl={displayRound.problemFileUrl}
          title={`${displayRound.name} — Problem Statement`}
          roundName={displayRound.name}
          trackName={workspaceData?.team?.track?.name}
        />
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {displayRound && canSubmitSelected && isLeader ? (
            <GlassCard glow className="p-8 rounded-[24px] bg-gradient-to-br from-card to-background border-orange-500/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-32 bg-orange-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 group-hover:bg-orange-500/10 transition-colors duration-500 pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                    </span>
                    <span className="text-sm font-semibold uppercase tracking-wider text-red-400">Action Required</span>
                  </div>
                  <h2 className="text-3xl font-bold mb-2">Submit {displayRound.name} Project</h2>
                  <p className="text-muted-foreground max-w-md">
                    Please submit your files and project links before the deadline.
                  </p>
                </div>
                <div className="flex flex-col items-center gap-4 bg-muted/50 backdrop-blur-md p-6 rounded-2xl border border-border/60 shadow-sm shrink-0">
                  <div className="flex items-center gap-2 text-foreground/80 mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-semibold">Time Remaining</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {timeLeft.days > 0 && (
                      <>
                        <div className="flex flex-col items-center justify-center bg-background border border-border rounded-xl min-w-[3.75rem] py-2 px-1 shadow-md">
                          <span className="text-2xl font-bold font-mono text-foreground leading-none tracking-tight">{timeLeft.days}</span>
                          <span className="text-[10px] text-muted-foreground uppercase mt-1.5 font-bold tracking-wider">Days</span>
                        </div>
                        <span className="text-muted-foreground font-bold text-lg mb-1">:</span>
                      </>
                    )}
                    <div className="flex flex-col items-center justify-center bg-background border border-border rounded-xl min-w-[3.75rem] py-2 px-1 shadow-md">
                      <span className="text-2xl font-bold font-mono text-foreground leading-none tracking-tight">{String(timeLeft.hours).padStart(2, "0")}</span>
                      <span className="text-[10px] text-muted-foreground uppercase mt-1.5 font-bold tracking-wider">Hrs</span>
                    </div>
                    <span className="text-muted-foreground font-bold text-lg mb-1">:</span>
                    <div className="flex flex-col items-center justify-center bg-background border border-border rounded-xl min-w-[3.75rem] py-2 px-1 shadow-md">
                      <span className="text-2xl font-bold font-mono text-foreground leading-none tracking-tight">{String(timeLeft.minutes).padStart(2, "0")}</span>
                      <span className="text-[10px] text-muted-foreground uppercase mt-1.5 font-bold tracking-wider">Mins</span>
                    </div>
                  </div>
                  <Link href={`${basePath}/submissions?roundId=${displayRound.id}`} className="w-full">
                    <Button variant="orange" className="w-full mt-2 rounded-xl h-11 shadow-[0_0_15px_rgba(243,112,33,0.3)]">
                      <Upload className="h-4 w-4 mr-2" />
                      {selectedRoundEntry?.submission ? "Resubmit / Edit" : "Upload Files"}
                    </Button>
                  </Link>
                </div>
              </div>
            </GlassCard>
          ) : displayRound ? (
            <GlassCard className={`p-8 rounded-[24px] bg-gradient-to-br from-card to-background relative overflow-hidden group ${selectedRoundEntry?.teamRound?.status === 'advanced' ? 'border-green-500/20' : 'border-blue-500/20'}`}>
              <div className={`absolute top-0 right-0 p-32 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none ${selectedRoundEntry?.teamRound?.status === 'advanced' ? 'bg-green-500/5' : 'bg-blue-500/5'}`} />
              <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
                <div>
                  {selectedRoundEntry?.teamRound?.status === "advanced" ? (
                    <>
                      <div className="mb-4 flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-green-500" />
                        <span className="text-sm font-semibold uppercase tracking-wider text-green-500">Round Passed</span>
                      </div>
                      <h2 className="mb-2 text-3xl font-bold">Congratulations! You passed this round</h2>
                      <p className="max-w-md text-muted-foreground">
                        This is the result of the previous round. Your team has successfully advanced. You can review your submission and judge feedback.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="mb-4 flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-blue-500" />
                        <span className="text-sm font-semibold uppercase tracking-wider text-blue-500">Member Access</span>
                      </div>
                      <h2 className="mb-2 text-3xl font-bold">Competition Rules</h2>
                      <p className="max-w-md text-muted-foreground">
                        Review participation rules, team responsibilities, and submission requirements. Only the team leader can submit.
                      </p>
                    </>
                  )}
                </div>
                <div className="min-w-[220px] rounded-2xl border border-border bg-background/50 p-6 backdrop-blur-md">
                  <p className="text-sm font-medium text-muted-foreground">Current phase</p>
                  <p className="mt-2 font-semibold">{displayRound.name}</p>
                  <Button asChild variant="outline" className="mt-5 w-full rounded-xl">
                    <Link href={`${basePath}/submissions?roundId=${displayRound.id}`}>
                      <FileText className="mr-2 h-4 w-4" />
                      View Submissions
                    </Link>
                  </Button>
                </div>
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="p-8 rounded-[24px] bg-card border-border flex items-center justify-center">
              <p className="text-muted-foreground">No active round currently.</p>
            </GlassCard>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-6">
            <GlassCard className="p-6 rounded-[24px] hover:bg-white/[0.02] transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-orange-500/10 text-orange-500 rounded-2xl">
                  <Award className="h-6 w-6" />
                </div>
              </div>
              <h3 className="text-3xl font-bold mb-1">
                {isLeader
                  ? selectedRoundEntry?.submission
                    ? "Submitted"
                    : "Pending"
                  : displayRound?.name || "No active round"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isLeader ? "Round Submission Status" : "Current Competition Phase"}
              </p>
            </GlassCard>

            <GlassCard className="p-6 rounded-[24px] hover:bg-white/[0.02] transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4 text-muted-foreground">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  <span className="font-semibold text-foreground">Team Activity</span>
                </div>
                <p className="text-sm text-muted-foreground">Check out your team members and roles.</p>
              </div>
              <Link href={`${basePath}/my-team`}>
                <Button variant="ghost" className="w-full justify-between mt-4 hover:bg-white/5">
                  View Team Members
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </GlassCard>
          </div>
        </div>

        {/* Right Sidebar — Recent Feedback */}
        <div className="space-y-6">
          <GlassCard className="p-6 rounded-[24px] h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-orange-500" />
                Recent Feedback
              </h2>
            </div>
            <div className="flex-1 space-y-4">
              {workspaceData?.mentorFeedbacks && workspaceData.mentorFeedbacks.length > 0 ? (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                workspaceData.mentorFeedbacks.slice(0, 3).map((feedback: any) => (
                  <div key={feedback.id} className="rounded-xl border border-border bg-muted/30 p-4 relative group">
                    <div className="flex justify-between items-start mb-2">
                      <Badge
                        variant={feedback.status === "completed" ? "success" : feedback.status === "acknowledged" ? "outline" : "warning"}
                        className="text-[10px] px-1.5 h-5 uppercase tracking-wider"
                      >
                        {feedback.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {feedback.createdAt ? new Date(feedback.createdAt).toLocaleDateString() : ""}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-3 text-foreground/90">{feedback.content}</p>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-8">
                  <p className="text-sm text-muted-foreground">No feedback yet.</p>
                </div>
              )}
            </div>
            <Link href={`${basePath}/mentor${selectedRoundId ? `?roundId=${selectedRoundId}` : ""}`} className="mt-6 block">
              <Button variant="outline" className="w-full rounded-xl border-border hover:bg-muted">
                Open Mentor Hub
              </Button>
            </Link>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
