"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Award, Crown, Medal, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, Minus, Star, Heart,
  BarChart3, Users, Loader2, Gavel, Send, Globe, Trophy,
  Sparkles
} from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getDetailedRoundRankings,
  getOrganizerEvent,
  publishRoundResults,
  DetailedRankedTeamEntry,
  DetailedRankingsResponse,
  PublishResultsPayload,
  OrganizerPrize
} from "@/lib/api/organizer-events.api";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { DetailedJudgeScore } from "@/lib/api/organizer-events.api";

const ANOMALY_THRESHOLD = 1.5;

function getJudgeCardPresentation(status: DetailedJudgeScore["status"]) {
  switch (status) {
    case "completed":
      return {
        card: "border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 via-orange-500/12 to-orange-500/5 shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-500/25",
        name: "text-foreground",
        score: "text-xl font-black text-emerald-600 dark:text-emerald-400 drop-shadow-sm",
        chip: "border-emerald-500/35 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 font-semibold",
        comment: "text-foreground/75",
        empty: "",
      };
    case "partial":
      return {
        card: "border-amber-500/35 bg-gradient-to-br from-amber-500/15 to-amber-500/5 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/15",
        name: "text-foreground/90",
        score: "text-base font-bold text-amber-600 dark:text-amber-400",
        chip: "border-amber-500/30 bg-amber-500/12 text-amber-800 dark:text-amber-200",
        comment: "text-muted-foreground",
        empty: "",
      };
    default:
      return {
        card: "border-dashed border-border/70 bg-muted/25 shadow-none opacity-55 saturate-50",
        name: "text-muted-foreground",
        score: "text-sm font-medium text-muted-foreground",
        chip: "border-border/60 bg-muted/40 text-muted-foreground",
        comment: "text-muted-foreground/80",
        empty: "text-muted-foreground/70",
      };
  }
}

function compareRankedEntries(
  a: DetailedRankedTeamEntry,
  b: DetailedRankedTeamEntry,
) {
  if (a.finalScore === null && b.finalScore === null) return 0;
  if (a.finalScore === null) return 1;
  if (b.finalScore === null) return -1;
  if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
  const bVotes = b.totalVotes ?? 0;
  const aVotes = a.totalVotes ?? 0;
  if (bVotes !== aVotes) return bVotes - aVotes;
  const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
  const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
  return aTime - bTime;
}

const AWARD_PRESENTATION_STYLES = [
  {
    icon: Crown,
    rowClass: "border border-yellow-300 bg-yellow-50/70 shadow-sm dark:border-yellow-400/50 dark:bg-yellow-950/30 dark:bg-gradient-to-r dark:from-yellow-500/10 dark:via-yellow-500/5 dark:to-transparent dark:shadow-[0_0_18px_rgba(234,179,8,0.14)]",
    headerClass: "bg-transparent",
    badgeClass: "text-yellow-900 border-yellow-300 bg-yellow-100/80 dark:text-yellow-100 dark:border-yellow-300/60 dark:bg-yellow-500/20 dark:shadow-[0_0_14px_rgba(250,204,21,0.28)]",
    iconClass: "text-yellow-500 fill-yellow-500 dark:text-yellow-300 dark:fill-yellow-300",
    scoreClass: "text-yellow-700 dark:text-yellow-200 dark:drop-shadow-[0_0_8px_rgba(250,204,21,0.35)]",
    titleClass: "text-yellow-950 dark:text-yellow-50",
    ringClass: "bg-yellow-100 ring-yellow-300 dark:bg-yellow-500/20 dark:ring-yellow-300/60 dark:shadow-[0_0_16px_rgba(250,204,21,0.3)]",
  },
  {
    icon: Medal,
    rowClass: "border border-slate-300 bg-slate-50/80 shadow-sm dark:border-slate-400/40 dark:bg-slate-900/80 dark:bg-gradient-to-r dark:from-slate-300/10 dark:via-slate-500/5 dark:to-transparent dark:shadow-[0_0_14px_rgba(203,213,225,0.1)]",
    headerClass: "bg-transparent",
    badgeClass: "text-slate-700 border-slate-300 bg-slate-100/80 dark:text-slate-100 dark:border-slate-300/60 dark:bg-slate-300/20 dark:shadow-[0_0_12px_rgba(203,213,225,0.2)]",
    iconClass: "text-slate-500 dark:text-slate-200",
    scoreClass: "text-slate-700 dark:text-slate-100 dark:drop-shadow-[0_0_8px_rgba(226,232,240,0.25)]",
    titleClass: "text-slate-900 dark:text-slate-50",
    ringClass: "bg-slate-100 ring-slate-300 dark:bg-slate-300/20 dark:ring-slate-300/60 dark:shadow-[0_0_14px_rgba(203,213,225,0.2)]",
  },
  {
    icon: Award,
    rowClass: "border border-orange-300 bg-orange-50/70 shadow-sm dark:border-orange-500/40 dark:bg-orange-950/30 dark:bg-gradient-to-r dark:from-orange-500/10 dark:via-orange-500/5 dark:to-transparent dark:shadow-[0_0_14px_rgba(249,115,22,0.1)]",
    headerClass: "bg-transparent",
    badgeClass: "text-orange-900 border-orange-300 bg-orange-100/80 dark:text-orange-100 dark:border-orange-400/50 dark:bg-orange-500/20 dark:shadow-[0_0_12px_rgba(251,146,60,0.2)]",
    iconClass: "text-orange-500 dark:text-orange-300",
    scoreClass: "text-orange-700 dark:text-orange-100 dark:drop-shadow-[0_0_8px_rgba(251,146,60,0.25)]",
    titleClass: "text-orange-950 dark:text-orange-50",
    ringClass: "bg-orange-100 ring-orange-300 dark:bg-orange-500/20 dark:ring-orange-400/50 dark:shadow-[0_0_14px_rgba(251,146,60,0.18)]",
  },
  {
    icon: Sparkles,
    rowClass: "border border-sky-300 bg-sky-50/70 shadow-sm dark:border-sky-400/40 dark:bg-sky-950/30 dark:bg-gradient-to-r dark:from-sky-500/10 dark:via-cyan-500/5 dark:to-transparent dark:shadow-[0_0_14px_rgba(56,189,248,0.1)]",
    headerClass: "bg-transparent",
    badgeClass: "text-sky-900 border-sky-300 bg-sky-100/80 dark:text-sky-100 dark:border-sky-300/50 dark:bg-sky-500/20 dark:shadow-[0_0_10px_rgba(56,189,248,0.16)]",
    iconClass: "text-sky-500 dark:text-sky-200",
    scoreClass: "text-sky-700 dark:text-sky-100",
    titleClass: "text-sky-950 dark:text-sky-50",
    ringClass: "bg-sky-100 ring-sky-300 dark:bg-sky-500/10 dark:ring-sky-300/50 dark:shadow-[0_0_12px_rgba(56,189,248,0.16)]",
  },
];

type RankingTrackGroup = DetailedRankingsResponse["tracks"][number];

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

const RANK_PRESENTATION: Record<1 | 2 | 3, {
  rowClass: string;
  headerClass: string;
  iconClass: string;
  scoreClass: string;
  titleClass: string;
  ringClass: string;
}> = {
  1: {
    rowClass: "border border-yellow-300 bg-yellow-50/50 shadow-sm dark:border-yellow-400/40 dark:bg-yellow-950/25 dark:bg-gradient-to-r dark:from-yellow-500/10 dark:to-transparent dark:shadow-[0_0_12px_rgba(234,179,8,0.1)]",
    headerClass: "bg-transparent",
    iconClass: "text-yellow-500 fill-yellow-500 dark:text-yellow-400 dark:fill-yellow-400",
    scoreClass: "text-yellow-700 dark:text-yellow-100",
    titleClass: "text-yellow-950 dark:text-yellow-50",
    ringClass: "bg-yellow-100 ring-yellow-300 dark:bg-yellow-500/10 dark:ring-yellow-400/50 dark:shadow-[0_0_12px_rgba(250,204,21,0.18)]",
  },
  2: {
    rowClass: "border border-slate-300 bg-slate-50/50 shadow-sm dark:border-slate-400/40 dark:bg-slate-900/70 dark:bg-gradient-to-r dark:from-slate-300/10 dark:to-transparent",
    headerClass: "bg-transparent",
    iconClass: "text-slate-500 dark:text-slate-300",
    scoreClass: "text-slate-700 dark:text-slate-100",
    titleClass: "text-slate-900 dark:text-slate-50",
    ringClass: "bg-slate-100 ring-slate-300 dark:bg-slate-300/10 dark:ring-slate-300/40",
  },
  3: {
    rowClass: "border border-orange-300 bg-orange-50/50 shadow-sm dark:border-orange-500/40 dark:bg-orange-950/25 dark:bg-gradient-to-r dark:from-orange-500/10 dark:to-transparent",
    headerClass: "bg-transparent",
    iconClass: "text-orange-500 dark:text-orange-300",
    scoreClass: "text-orange-700 dark:text-orange-100",
    titleClass: "text-orange-950 dark:text-orange-50",
    ringClass: "bg-orange-100 ring-orange-300 dark:bg-orange-500/10 dark:ring-orange-400/40",
  },
};

function getAwardPresentation(award?: OrganizerPrize | null, allPrizes?: OrganizerPrize[]) {
  if (!award) return null;

  if (award.placement === 1) return AWARD_PRESENTATION_STYLES[0];
  if (award.placement === 2) return AWARD_PRESENTATION_STYLES[1];
  if (award.placement === 3) return AWARD_PRESENTATION_STYLES[2];

  // Backward-compatible fallback for prize records created before placement existed.
  const name = (award.name || "").toLowerCase();
  if (name.includes("champion") || name.includes("first") || name.includes("gold") || name.includes("nhất")) {
    return AWARD_PRESENTATION_STYLES[0]; // Gold Crown 👑
  }
  if (name.includes("second") || name.includes("runner") || name.includes("silver") || name.includes("nhì")) {
    return AWARD_PRESENTATION_STYLES[1]; // Silver Medal 🥈
  }
  if (name.includes("third") || name.includes("bronze") || name.includes("ba")) {
    return AWARD_PRESENTATION_STYLES[2]; // Bronze Ribbon 🥉
  }
  if (name.includes("honorable") || name.includes("mention") || name.includes("khuyến khích")) {
    return AWARD_PRESENTATION_STYLES[3]; // Sky Blue Sparkles ✨
  }

  // 2. Fallback to index position in event's configured prizes array
  if (allPrizes && allPrizes.length > 0) {
    const idx = allPrizes.findIndex(p => p.id === award.id || p.name === award.name);
    if (idx >= 0) {
      return AWARD_PRESENTATION_STYLES[Math.min(idx, AWARD_PRESENTATION_STYLES.length - 1)];
    }
  }

  return AWARD_PRESENTATION_STYLES[3];
}

function getRankPresentation(rank: number) {
  return rank === 1 || rank === 2 || rank === 3 ? RANK_PRESENTATION[rank] : null;
}

function getAwardPriority(award?: OrganizerPrize | null) {
  return award
    ? (award.placement ?? award.id ?? Number.POSITIVE_INFINITY)
    : Number.POSITIVE_INFINITY;
}

function RankBadge({ rank, award }: { rank: number; award?: OrganizerPrize | null }) {
  const awardPresentation = getAwardPresentation(award);
  const rankPresentation = getRankPresentation(rank);

  if (awardPresentation) {
    const Icon = awardPresentation.icon;
    const isChampion = getAwardPresentation(award) === AWARD_PRESENTATION_STYLES[0];

    return (
      <motion.div
        title={award?.name || "Award"}
        animate={isChampion ? { y: [0, -2, 0], rotate: [-2, 2, -2] } : undefined}
        transition={isChampion ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : undefined}
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ${awardPresentation.ringClass}`}
      >
        {isChampion && (
          <motion.span
            className="absolute -right-1 -top-1"
            animate={{ scale: [0.8, 1.15, 0.8], opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="h-3.5 w-3.5 text-yellow-200" />
          </motion.span>
        )}
        <Icon className={`h-5 w-5 ${awardPresentation.iconClass}`} />
      </motion.div>
    );
  }

  if (rank === 1) return (
    <motion.div
      title="Top 1 of Track"
      animate={{ y: [0, -2, 0] }}
      transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ${rankPresentation?.ringClass}`}
    >
      <Crown className={`h-4 w-4 ${rankPresentation?.iconClass}`} />
    </motion.div>
  );
  if (rank === 2) return (
    <div title="Top 2 of Track" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ${rankPresentation?.ringClass}`}>
      <Medal className={`h-4 w-4 ${rankPresentation?.iconClass}`} />
    </div>
  );
  if (rank === 3) return (
    <div title="Top 3 of Track" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ${rankPresentation?.ringClass}`}>
      <Award className={`h-4 w-4 ${rankPresentation?.iconClass}`} />
    </div>
  );
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted/30 ring-1 ring-border text-sm font-bold text-muted-foreground">
      {rank}
    </div>
  );
}

function AwardBadge({ award, isPreview }: { award: OrganizerPrize; isPreview?: boolean }) {
  const awardPresentation = getAwardPresentation(award)!;
  const Icon = awardPresentation.icon;

  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-2 py-0.5 backdrop-blur-sm ${awardPresentation.badgeClass}`}
    >
      <Icon className={`w-3 h-3 mr-1.5 ${awardPresentation.iconClass}`} />
      {award.name}
      {isPreview && <span className="ml-1 opacity-70">(draft)</span>}
    </Badge>
  );
}

function AnomalyIndicator() {
  return (
    <span
      title={`Score variance detected: at least one judge deviates by ${ANOMALY_THRESHOLD} or more from the team average.`}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-600 shadow-sm dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      <span className="sr-only">Score variance detected</span>
    </span>
  );
}

function TeamRow({
  entry, 
  rank, 
  willAdvance,
  isPublished,
  isFinalRound,
  awardValue,
  prizes,
}: { 
  entry: DetailedRankedTeamEntry; 
  rank: number;
  willAdvance: boolean;
  isPublished: boolean;
  isFinalRound?: boolean;
  awardValue?: OrganizerPrize | null;
  prizes: OrganizerPrize[];
}) {
  const [expanded, setExpanded] = useState(false);
  const completedJudges = entry.judges.filter((j) => j.status === "completed");
  const hasAnomalous = completedJudges.some(
    (j) => j.deviationFromAverage !== null && Math.abs(j.deviationFromAverage) >= ANOMALY_THRESHOLD,
  );
  const judgesAssigned = entry.judgesAssigned ?? entry.judges.length;
  const judgesScored = entry.judgesScored ?? completedJudges.length;
  const sortedJudges = useMemo(() => {
    const statusOrder = { completed: 0, partial: 1, pending: 2 };
    return [...entry.judges].sort((a, b) => {
      const byStatus = statusOrder[a.status] - statusOrder[b.status];
      if (byStatus !== 0) return byStatus;
      return a.judgeName.localeCompare(b.judgeName);
    });
  }, [entry.judges]);
  const activeAward = isFinalRound ? ((isPublished ? entry.award : awardValue) ?? null) : null;
  const awardPresentation = getAwardPresentation(activeAward, prizes);
  const rankPresentation = getRankPresentation(rank);

  const isPassed = !isFinalRound && isPublished && entry.status === "advanced";
  const isEliminated = !isFinalRound && isPublished && entry.status === "eliminated";
  const isSelecting = !isPublished && !isFinalRound && willAdvance;
  const rowClass = awardPresentation
    ? awardPresentation.rowClass
    : isPassed
      ? "border-y border-r border-l-4 border-border border-l-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
      : isSelecting
        ? "border-2 border-dashed border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
        : isEliminated
          ? "border border-border opacity-50 grayscale-[50%] hover:grayscale-0 hover:opacity-100"
          : rankPresentation?.rowClass ?? "border border-border";
  const headerClass = awardPresentation
    ? awardPresentation.headerClass
    : isPassed
      ? "bg-transparent"
      : isSelecting
        ? "bg-emerald-500/5"
        : rankPresentation?.headerClass ?? "bg-card hover:bg-muted/20";
  const titleClass = isEliminated
    ? "text-muted-foreground"
    : awardPresentation?.titleClass ?? rankPresentation?.titleClass ?? "text-foreground";
  const scoreClass = awardPresentation?.scoreClass ?? rankPresentation?.scoreClass ?? "text-foreground";

  return (
    <div 
      className={`relative rounded-xl overflow-hidden mb-3 transition-all duration-300 ease-in-out ${rowClass}`}
    >
      {isPassed && <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />}
      {awardPresentation && (
        <div className="pointer-events-none absolute inset-0 hidden dark:block dark:bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.1),transparent_28%)]" />
      )}

      <div
        className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors relative z-10 ${headerClass}`}
      >
        <RankBadge rank={rank} award={activeAward} />

        <div className="flex-1 min-w-0" onClick={() => setExpanded(!expanded)} style={{cursor: "pointer"}}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-base truncate ${isPassed ? "text-emerald-700 dark:text-emerald-50 dark:drop-shadow-md" : titleClass}`}>
              {entry.teamName}
            </span>
            {isSelecting && (
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 text-[10px] px-1.5 py-0 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                <CheckCircle2 className="w-3 h-3 mr-1 animate-pulse" />Selected
              </Badge>
            )}
            {isPassed && !isFinalRound && (
              <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-500/30 dark:border-emerald-500/50 bg-emerald-500/10 dark:bg-emerald-500/20 text-[10px] px-2 py-0.5 shadow-sm dark:shadow-[0_0_10px_rgba(16,185,129,0.3)] backdrop-blur-sm">
                <Sparkles className="w-3 h-3 mr-1.5 text-emerald-600 dark:text-emerald-400 dark:drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]" /> Passed
              </Badge>
            )}
            {activeAward && (
              <AwardBadge award={activeAward} isPreview={!isPublished} />
            )}
            {isEliminated && !isFinalRound && (
              <Badge variant="outline" className="text-muted-foreground border-border bg-muted/50 text-[10px] px-1.5 py-0">
                <Minus className="w-3 h-3 mr-1" />Eliminated
              </Badge>
            )}
            {hasAnomalous && <AnomalyIndicator />}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Track: {entry.trackName} · Submitted: {format(new Date(entry.submittedAt), "MMM dd, HH:mm")}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className={`text-2xl font-bold tabular-nums ${scoreClass}`}>
              {entry.finalScore !== null ? entry.finalScore.toFixed(2) : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">/ 10.00</div>
          </div>
          <div className="h-10 w-px bg-border hidden sm:block"></div>
          <div className="text-right">
            <HoverCard>
              <HoverCardTrigger className="flex items-center gap-1.5 cursor-help hover:text-orange-500 transition-colors">
                <Star className="w-5 h-5 fill-current text-orange-400" />
                <span className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-400">{entry.totalVotes ?? 0}</span>
              </HoverCardTrigger>
              <HoverCardContent align="end" className="w-64">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Heart className="w-4 h-4 text-orange-500" /> Voted By
                  </h4>
                  {(!entry.votedBy || entry.votedBy.length === 0) ? (
                    <p className="text-xs text-muted-foreground">No votes yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2 mt-2">
                      {entry.votedBy.map((judge) => (
                        <div key={judge.id} className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 border">
                            <AvatarImage src={judge.avatarUrl} />
                            <AvatarFallback className="text-[10px]">{judge.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium truncate">{judge.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </HoverCardContent>
            </HoverCard>
            <div className="text-[10px] text-muted-foreground">Votes</div>
          </div>
        </div>

        <div className="flex items-center gap-1 text-muted-foreground text-sm shrink-0 ml-2">
          <Gavel className="w-4 h-4" />
          <span>
            {judgesScored}/{judgesAssigned} judge{judgesAssigned !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="text-muted-foreground ml-1" onClick={() => setExpanded(!expanded)} style={{cursor: "pointer"}}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded Analytics */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-5 grid md:grid-cols-2 gap-6 bg-muted/5 border-t border-border">
              {/* Criteria Breakdown */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Criteria Averages
                </h4>
                <div className="space-y-3">
                  {entry.criteriaAverages.map(ca => (
                    <div key={ca.criterionId}>
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="font-medium truncate max-w-[180px]">{ca.name}</span>
                        <span className="tabular-nums font-bold text-foreground ml-2 shrink-0">
                          {ca.averageScore.toFixed(2)} <span className="text-muted-foreground font-normal text-xs">/ {ca.maxScore}</span>
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((ca.averageScore / ca.maxScore) * 100, 100)}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Weight: {ca.weight}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Judge Matrix */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4" /> Judge Scores
                </h4>
                {sortedJudges.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No judges assigned to this track.</p>
                ) : (
                  <div className="space-y-3">
                    {sortedJudges.map(j => {
                      const presentation = getJudgeCardPresentation(j.status);
                      const statusLabel =
                        j.status === "completed"
                          ? "Completed"
                          : j.status === "partial"
                            ? "In progress"
                            : "Not scored";
                      const statusClass =
                        j.status === "completed"
                          ? "bg-emerald-500/25 text-emerald-800 dark:text-emerald-100 border border-emerald-500/30"
                          : j.status === "partial"
                            ? "bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/25"
                            : "bg-muted/60 text-muted-foreground border border-border/60";

                      return (
                        <div
                          key={j.judgeId}
                          className={cn(
                            "rounded-xl p-4 border transition-all duration-200",
                            presentation.card,
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="min-w-0 flex items-center gap-2">
                              <span className={cn("text-sm truncate max-w-[150px]", presentation.name)}>
                                {j.judgeName}
                              </span>
                              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", statusClass)}>
                                {statusLabel}
                              </span>
                            </div>
                            <span className={cn("tabular-nums shrink-0", presentation.score)}>
                              {j.totalGivenScore !== null ? j.totalGivenScore.toFixed(2) : "—"}
                            </span>
                          </div>
                          {j.comment && (
                            <p className={cn("text-[11px] italic border-t border-border/40 pt-2 mt-1 line-clamp-3", presentation.comment)}>
                              &ldquo;{j.comment}&rdquo;
                            </p>
                          )}
                          {j.status === "pending" ? (
                            <p className={cn("text-[11px] mt-2", presentation.empty)}>
                              No scores submitted yet.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {j.criteriaScores.length > 0 ? (
                                j.criteriaScores.map(cs => (
                                  <span
                                    key={cs.criterionId}
                                    className={cn(
                                      "text-[10px] border rounded-md px-2 py-0.5 tabular-nums shadow-sm",
                                      presentation.chip,
                                    )}
                                  >
                                    C{cs.criterionId}: {Number(cs.scoreValue).toFixed(1)}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RankingsPage() {
  const params = useParams();
  const eventId = params.id as string;
  const roundId = params.roundId as string;
  const queryClient = useQueryClient();

  const [selectedTrackIdx, setSelectedTrackIdx] = useState(0);
  const [sortMode, setSortMode] = useState<"score" | "votes">("score");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["detailedRankings", eventId, roundId],
    queryFn: () => getDetailedRoundRankings(eventId, roundId),
    refetchOnWindowFocus: false,
  });

  const { mutate: publish, isPending: isPublishing } = useMutation({
    mutationFn: async () => {
      const payload: PublishResultsPayload = {};
      const result = await publishRoundResults(eventId, roundId, payload);
      return result as { repoSyncStarted?: boolean };
    },
    onSuccess: (res: { repoSyncStarted?: boolean }) => {
      if (res.repoSyncStarted) {
        enqueueSnackbar("Results published! GitHub repositories are being provisioned in the background.", { variant: "info", autoHideDuration: 5000 });
      } else {
        enqueueSnackbar("Round results published successfully!", { variant: "success" });
      }
      setShowConfirmModal(false);
      queryClient.invalidateQueries({ queryKey: ["detailedRankings", eventId, roundId] });
      queryClient.invalidateQueries({ queryKey: ["organizerTeams", eventId] });
    },
    onError: (err: unknown) => {
      enqueueSnackbar(getErrorMessage(err, "Failed to publish results"), { variant: "error" });
    },
  });

  const round = data?.round;
  const { data: eventData } = useQuery({
    queryKey: ["organizerEvent", eventId],
    queryFn: () => getOrganizerEvent(eventId),
    refetchOnWindowFocus: false,
  });

  const prizeSlotCount = useMemo(
    () =>
      (eventData?.prizes || []).reduce(
        (sum, p) => sum + Math.max(0, p.quantity ?? 1),
        0,
      ),
    [eventData?.prizes],
  );

  const configuredAdvanceCount =
    round?.advanceCount != null && round.advanceCount >= 1
      ? round.advanceCount
      : null;

  const isResultsPublished = round?.status === "results_published";
  const isTrackSpecific = round?.isTrackSpecific !== false;
  const effectiveAdvanceCount = configuredAdvanceCount ?? 0;

  const advancingTeamIds = useMemo(() => {
    const next = new Set<number>();
    if (!data?.tracks || round?.isFinalRound || effectiveAdvanceCount < 1) return next;

    if (isTrackSpecific) {
      for (const trackGroup of data.tracks) {
        const scored = [...trackGroup.entries]
          .filter((e) => e.finalScore !== null)
          .sort(compareRankedEntries);
        scored.slice(0, effectiveAdvanceCount).forEach((e) => next.add(e.teamId));
      }
    } else {
      const pooled = data.tracks
        .flatMap((t) => t.entries)
        .filter((e) => e.finalScore !== null)
        .sort(compareRankedEntries);
      pooled.slice(0, effectiveAdvanceCount).forEach((e) => next.add(e.teamId));
    }
    return next;
  }, [data?.tracks, round?.isFinalRound, isTrackSpecific, effectiveAdvanceCount]);

  const previewAwards = useMemo(() => {
    const map: Record<number, OrganizerPrize> = {};
    if (!data?.tracks || !round?.isFinalRound) return map;

    const prizes = [...(eventData?.prizes || [])].sort((a, b) => {
      if (a.placement == null && b.placement == null) return a.id - b.id;
      if (a.placement == null) return 1;
      if (b.placement == null) return -1;
      if (a.placement !== b.placement) return a.placement - b.placement;
      return a.id - b.id;
    });

    const slots: OrganizerPrize[] = [];
    for (const prize of prizes) {
      const qty = Math.max(0, prize.quantity ?? 1);
      for (let i = 0; i < qty; i++) slots.push(prize);
    }
    if (slots.length === 0) return map;

    const assign = (entries: DetailedRankedTeamEntry[]) => {
      const scored = [...entries]
        .filter((e) => e.finalScore !== null)
        .sort(compareRankedEntries);
      const limit = Math.min(slots.length, scored.length);
      for (let i = 0; i < limit; i++) {
        map[scored[i].teamId] = slots[i];
      }
    };

    // Final: rank all finalists together for prize slots (not per track).
    assign(data.tracks.flatMap((t) => t.entries));
    return map;
  }, [data?.tracks, round?.isFinalRound, eventData?.prizes]);

  const previewAwardCount = Object.keys(previewAwards).length;
  
  const tracks = useMemo<RankingTrackGroup[]>(() => {
    if (!data?.tracks) return [];
    
    const processedTracks = data.tracks.map(t => {
      const sortedEntries = [...t.entries].sort((a, b) => {
        if (sortMode === "votes") {
          const bVotes = b.totalVotes ?? 0;
          const aVotes = a.totalVotes ?? 0;
          if (bVotes !== aVotes) return bVotes - aVotes;
        }
        if (a.finalScore === null && b.finalScore === null) return 0;
        if (a.finalScore === null) return 1;
        if (b.finalScore === null) return -1;
        return b.finalScore - a.finalScore;
      });
      return { ...t, entries: sortedEntries };
    });

    const allEntries = processedTracks.flatMap((trackGroup) => trackGroup.entries);
    allEntries.sort((a, b) => {
      if (sortMode === "votes") {
        const bVotes = b.totalVotes ?? 0;
        const aVotes = a.totalVotes ?? 0;
        if (bVotes !== aVotes) return bVotes - aVotes;
      }
      if (a.finalScore === null && b.finalScore === null) return 0;
      if (a.finalScore === null) return 1;
      if (b.finalScore === null) return -1;
      return b.finalScore - a.finalScore;
    });

    const allTracksGroup = {
      track: { id: -1, name: "All Tracks" },
      entries: allEntries
    };

    return [allTracksGroup, ...processedTracks];
  }, [data, sortMode]);

  const visibleTracks = useMemo(
    () =>
      round?.isFinalRound && tracks.length > 0
        ? [tracks[0]]
        : tracks,
    [tracks, round?.isFinalRound],
  );

  const selectedTrack = visibleTracks[selectedTrackIdx] ?? visibleTracks[0];
  const entries = useMemo<DetailedRankedTeamEntry[]>(() => {
    let raw = selectedTrack?.entries ?? [];
    if (isResultsPublished && round?.isFinalRound) {
      raw = [...raw].sort((a, b) => {
        const awardDiff = getAwardPriority(a.award) - getAwardPriority(b.award);
        if (awardDiff !== 0) return awardDiff;
        if (a.finalScore === null && b.finalScore === null) return (a.rank || 0) - (b.rank || 0);
        if (a.finalScore === null) return 1;
        if (b.finalScore === null) return -1;
        if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
        return (a.rank || 0) - (b.rank || 0);
      });
    } else if (isResultsPublished) {
      raw = [...raw].sort((a, b) => {
        if (a.status === "advanced" && b.status !== "advanced") return -1;
        if (a.status !== "advanced" && b.status === "advanced") return 1;
        return (a.rank || 0) - (b.rank || 0);
      });
    }
    return raw;
  }, [selectedTrack, isResultsPublished, round?.isFinalRound]);

  const roundStatusColor: Record<string, string> = {
    not_started: "text-muted-foreground",
    open: "text-blue-500",
    closed: "text-orange-500",
    results_published: "text-emerald-500",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-blue-500" />
            Rankings & Analytics
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Detailed team rankings, scoring breakdown, and judge variance analytics.
          </p>
          {round && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-base font-bold text-foreground">{round.name}</span>
              <Badge variant="outline" className={`text-xs capitalize font-semibold ${roundStatusColor[round.status] ?? ""}`}>
                {round.status?.replace(/_/g, " ")}
              </Badge>
              {round.isFinalRound ? (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-300 font-semibold gap-1.5 px-2.5 py-1 text-xs">
                  <Trophy className="w-3.5 h-3.5" /> Chung kết · tự gán {prizeSlotCount} giải
                </Badge>
              ) : round.isTrackSpecific !== false ? (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-300 font-semibold gap-1.5 px-2.5 py-1 text-xs">
                  <Users className="w-3.5 h-3.5" /> Track-Specific Evaluation
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-300 font-semibold gap-1.5 px-2.5 py-1 text-xs">
                  <Globe className="w-3.5 h-3.5" /> Global Evaluation (All Tracks)
                </Badge>
              )}
            </div>
          )}
        </div>

        {!isResultsPublished && round && (
          <GlassCard className="p-4 flex flex-col sm:flex-row sm:items-end gap-3 shrink-0">
            {round.isFinalRound ? (
              <div className="space-y-1 text-sm text-muted-foreground max-w-md">
                <p>
                  Vòng cuối — tự gán{" "}
                  <strong className="text-foreground">{prizeSlotCount}</strong> giải
                  cho top {prizeSlotCount} đội (xếp chung mọi finalist, theo Event → Prizes).
                </p>
                {prizeSlotCount === 0 ? (
                  <p className="text-amber-600 dark:text-amber-400 text-xs">
                    Thêm giải trong Event trước khi publish.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Advance (từ cấu hình round)
                </Label>
                <p className="text-sm">
                  {configuredAdvanceCount != null ? (
                    <>
                      Top{" "}
                      <strong className="tabular-nums">{configuredAdvanceCount}</strong>
                      {isTrackSpecific ? " / bảng" : " / vòng"}
                      {" → "}
                      <strong className="tabular-nums">{advancingTeamIds.size}</strong>{" "}
                      đội vào vòng sau
                    </>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">
                      Chưa set advanceCount — sửa round ở Tracks & Rounds.
                    </span>
                  )}
                </p>
              </div>
            )}
            {round.status === "closed" ? (
              <Button
                onClick={() => setShowConfirmModal(true)}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 h-10"
                disabled={
                  round.isFinalRound
                    ? prizeSlotCount < 1
                    : configuredAdvanceCount == null
                }
              >
                <Send className="w-4 h-4" />
                Publish Results
                {round.isFinalRound
                  ? ` (${prizeSlotCount} giải)`
                  : configuredAdvanceCount != null
                    ? ` (${advancingTeamIds.size})`
                    : ""}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground max-w-[200px] pb-1">
                Close the round to publish.
                {!round.isFinalRound && configuredAdvanceCount != null
                  ? " Advance lấy từ cấu hình round."
                  : ""}
              </p>
            )}
          </GlassCard>
        )}
        {round?.status === "results_published" && (
          <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5" />
            Results have been published
          </div>
        )}
      </div>

      {/* Track Tabs & Sort Controls */}
      {visibleTracks.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-2 flex-wrap">
            {visibleTracks.map((t, idx) => (
              <button
                key={t.track.id}
                onClick={() => setSelectedTrackIdx(idx)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                  idx === selectedTrackIdx
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {round?.isFinalRound ? "Xếp chung finalist" : t.track.name}
                <span className="ml-2 text-xs opacity-60">({t.entries.length})</span>
              </button>
            ))}
          </div>

          <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border">
            <button
              onClick={() => setSortMode("score")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sortMode === "score"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sort by Score
            </button>
            <button
              onClick={() => setSortMode("votes")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                sortMode === "votes"
                  ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-current" /> Sort by Votes
            </button>
          </div>
        </div>
      )}

      {round?.isFinalRound && !isResultsPublished && (eventData?.prizes?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-card/80 p-4 rounded-2xl border border-border shadow-sm">
          <span className="text-sm font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Auto prize preview — top {prizeSlotCount} đội nhận {prizeSlotCount} giải:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {eventData?.prizes?.map((prize) => {
              const assignedCount = Object.values(previewAwards).filter(
                (a) => a?.id === prize.id,
              ).length;
              const maxQty = prize.quantity ?? 1;
              const isFull = assignedCount >= maxQty;
              return (
                <Badge
                  key={prize.id}
                  variant="outline"
                  className={`gap-1.5 px-3 py-1 text-xs font-semibold ${
                    isFull
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-300"
                  }`}
                >
                  <span>{prize.name}:</span>
                  <span className="font-bold tabular-nums">
                    {assignedCount} / {maxQty}
                  </span>
                  {isFull ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : null}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Rankings List */}
      <GlassCard className="p-6 rounded-[24px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading rankings...</span>
          </div>
        ) : isError ? (
          <div className="text-center py-20 text-red-500 text-sm">
            Failed to load rankings data.
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground text-sm">
            No teams with completed submissions found for this track.
          </div>
        ) : (
          <div>
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mb-5 pb-4 border-b border-border text-xs text-muted-foreground">
              {isResultsPublished && round?.isFinalRound ? (
                <>
                  {eventData?.prizes?.map((prize) => {
                    const awardPresentation = getAwardPresentation(prize)!;
                    const Icon = awardPresentation.icon;
                    return (
                      <span key={prize.id} className="flex items-center gap-1">
                        <Icon className={`w-3.5 h-3.5 ${awardPresentation.iconClass}`} />
                        {prize.name}
                      </span>
                    );
                  })}
                </>
              ) : !isResultsPublished && !round?.isFinalRound ? (
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Will advance on publish</span>
              ) : !isResultsPublished && round?.isFinalRound ? (
                <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5 text-yellow-500" /> Prize preview (auto)</span>
              ) : (
                <>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Passed (Advanced)</span>
                  <span className="flex items-center gap-1"><Minus className="w-3.5 h-3.5 text-red-500" /> Eliminated</span>
                </>
              )}
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
                Score variance detected
              </span>
            </div>

            {entries.map((entry, idx) => (
              <TeamRow 
                key={entry.teamId} 
                entry={entry} 
                rank={entry.rank || idx + 1} 
                willAdvance={advancingTeamIds.has(entry.teamId)}
                isPublished={isResultsPublished}
                isFinalRound={round?.isFinalRound}
                awardValue={previewAwards[entry.teamId] ?? null}
                prizes={eventData?.prizes || []}
              />
            ))}
          </div>
        )}
      </GlassCard>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-xl"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">Confirm Publish Results</h3>
              <p className="text-sm text-muted-foreground mb-6">
                {round?.isFinalRound ? (
                  <>
                    Auto-assign <strong>{prizeSlotCount}</strong> prize slot(s) to the
                    top-ranked finalists <strong>across all tracks</strong> (
                    {previewAwardCount} team(s) previewed).
                    <br /><br />
                    This finalizes official results and notifies participants.
                  </>
                ) : (
                  <>
                    Advance top{" "}
                    <strong>{configuredAdvanceCount ?? "—"}</strong>
                    {isTrackSpecific ? " / bảng" : " / vòng"} (
                    <strong>{advancingTeamIds.size}</strong> đội). Còn lại bị loại.
                    <br /><br />
                    Thiết lập tại Tracks & Rounds — không chỉnh tay trên trang này.
                    <br /><br />
                    Không thể hoàn tác; sẽ gửi email thông báo.
                  </>
                )}
              </p>
              <div className="flex items-center gap-3 w-full">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isPublishing}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" 
                  onClick={() => publish()}
                  disabled={isPublishing}
                >
                  {isPublishing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirm & Publish
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
