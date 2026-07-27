"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Award, Crown, Medal, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, TrendingUp, TrendingDown, Minus, Star, Heart,
  BarChart3, Users, Loader2, Gavel, Send, Globe, Trophy,
  Sparkles, type LucideIcon
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

const ANOMALY_THRESHOLD = 1.5;

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

  // 1. Match by name keywords for precise icon & style mapping
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
  return award ? (award.id || Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
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

function DeviationBadge({ deviation }: { deviation: number }) {
  const isAnomaly = Math.abs(deviation) >= ANOMALY_THRESHOLD;
  const isPositive = deviation > 0;
  const isZero = Math.abs(deviation) < 0.01;

  if (isZero) return (
    <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
      <Minus className="w-3 h-3" /> 0.00
    </span>
  );
  return (
    <span className={`flex items-center gap-1 text-xs font-bold ${isAnomaly ? "text-amber-600 dark:text-amber-300" : isPositive ? "text-emerald-500" : "text-blue-400"}`}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isPositive ? "+" : ""}{deviation.toFixed(2)}
      {isAnomaly && <AlertTriangle className="w-3 h-3 ml-0.5" />}
    </span>
  );
}

function TeamRow({ 
  entry, 
  rank, 
  isSelected, 
  onToggle,
  isPublished,
  isFinalRound,
  awardValue,
  onAwardChange,
  prizes,
  teamAwards
}: { 
  entry: DetailedRankedTeamEntry; 
  rank: number;
  isSelected: boolean;
  onToggle: () => void;
  isPublished: boolean;
  isFinalRound?: boolean;
  awardValue?: OrganizerPrize | null;
  onAwardChange?: (val: OrganizerPrize | null) => void;
  prizes: OrganizerPrize[];
  teamAwards?: Record<number, OrganizerPrize | null>;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasAnomalous = entry.judges.some(j => Math.abs(j.deviationFromAverage) >= ANOMALY_THRESHOLD);
  const activeAward = isFinalRound ? ((isPublished ? entry.award : awardValue) ?? null) : null;
  const awardPresentation = getAwardPresentation(activeAward, prizes);
  const rankPresentation = getRankPresentation(rank);

  const isPassed = !isFinalRound && isPublished && entry.status === "advanced";
  const isEliminated = !isFinalRound && isPublished && entry.status === "eliminated";
  const isSelecting = !isPublished && isSelected;
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
      {/* Background Glow for Passed */}
      {isPassed && <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />}
      {awardPresentation && (
        <div className="pointer-events-none absolute inset-0 hidden dark:block dark:bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.1),transparent_28%)]" />
      )}

      {/* Team Header Row */}
      <div
        className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors relative z-10 ${headerClass}`}
      >
        {!isPublished && !isFinalRound && (
          <div className="shrink-0 pt-1">
            <input 
              type="checkbox" 
              checked={isSelected}
              onChange={onToggle}
              className="w-5 h-5 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>
        )}
        {!isPublished && isFinalRound && (
          <div className="shrink-0">
             <select 
               className="w-[260px] shrink-0 bg-background border border-border text-sm font-medium rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 shadow-sm truncate"
               value={awardValue?.id || ""}
               onChange={(e) => {
                 const prizeId = Number(e.target.value);
                 const prize = prizes.find(p => p.id === prizeId);
                 onAwardChange?.(prize || null);
               }}
             >
               <option value="">No Award</option>
               {prizes.map((prize) => {
                 const assignedCount = Object.values(teamAwards || {}).filter(a => a?.id === prize.id).length;
                 const isCurrentSelection = awardValue?.id === prize.id;
                 const maxQty = prize.quantity ?? 1;
                 const isFull = !isCurrentSelection && assignedCount >= maxQty;
                 return (
                   <option key={prize.id} value={prize.id} disabled={isFull}>
                     {prize.name} ({assignedCount}/{maxQty}){isFull ? " — FULL" : ""}
                   </option>
                 );
               })}
             </select>
          </div>
        )}
        
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
          <span>{entry.judges.length} judge{entry.judges.length !== 1 ? "s" : ""}</span>
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
                  <Users className="w-4 h-4" /> Judge Scores & Deviation
                </h4>
                {entry.judges.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No completed scores yet.</p>
                ) : (
                  <div className="space-y-3">
                    {entry.judges.map(j => {
                      const isAnomaly = Math.abs(j.deviationFromAverage) >= ANOMALY_THRESHOLD;
                      return (
                        <div key={j.judgeId} className={`rounded-lg p-3 border ${isAnomaly ? "border-amber-400/40 bg-amber-50/60 dark:bg-amber-400/10" : "border-border bg-muted/20"}`}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-sm font-semibold truncate max-w-[150px]">{j.judgeName}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-sm font-bold tabular-nums">{j.totalGivenScore.toFixed(2)}</span>
                              <DeviationBadge deviation={j.deviationFromAverage} />
                            </div>
                          </div>
                          {j.comment && (
                            <p className="text-[11px] text-muted-foreground italic border-t border-border/50 pt-2 mt-1 line-clamp-2">
                              &ldquo;{j.comment}&rdquo;
                            </p>
                          )}
                          {/* Per-criteria breakdown */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {j.criteriaScores.map(cs => (
                              <span key={cs.criterionId} className="text-[10px] bg-background border border-border rounded px-1.5 py-0.5 tabular-nums">
                                C{cs.criterionId}: {Number(cs.scoreValue).toFixed(1)}
                              </span>
                            ))}
                          </div>
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
  const [autoSelectTopN, setAutoSelectTopN] = useState(3);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<number>>(new Set());
  const [teamAwards, setTeamAwards] = useState<Record<number, OrganizerPrize | null>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const awardedTeamEntries = useMemo(
    () => Object.entries(teamAwards).filter((entry): entry is [string, OrganizerPrize] => Boolean(entry[1])),
    [teamAwards],
  );
  const awardedCount = awardedTeamEntries.length;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["detailedRankings", eventId, roundId],
    queryFn: () => getDetailedRoundRankings(eventId, roundId),
    refetchOnWindowFocus: false,
  });

  const { mutate: publish, isPending: isPublishing } = useMutation({
    mutationFn: async () => {
       const payload: PublishResultsPayload = {};
       if (data?.round?.isFinalRound) {
         payload.awards = awardedTeamEntries.map(([teamId, award]) => ({
           teamId: Number(teamId),
           awardId: award.id
         }));
       } else {
         payload.advancingTeamIds = Array.from(selectedTeamIds);
       }
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
  const isResultsPublished = round?.status === "results_published";
  
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

  const selectedTrack = tracks[selectedTrackIdx];
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

  const handleToggleTeam = (teamId: number) => {
    const next = new Set(selectedTeamIds);
    if (next.has(teamId)) {
      next.delete(teamId);
    } else {
      next.add(teamId);
    }
    setSelectedTeamIds(next);
  };

  const handleAutoSelect = () => {
    const next = new Set<number>();
    data?.tracks?.forEach((trackGroup) => {
      const topEntries = trackGroup.entries
        .filter((entry) => entry.finalScore !== null)
        .slice(0, autoSelectTopN);
      topEntries.forEach((entry) => next.add(entry.teamId));
    });
    setSelectedTeamIds(next);
    enqueueSnackbar(`Auto-selected top ${autoSelectTopN} teams for all tracks.`, { variant: "info" });
  };

  const handleAwardChange = (teamId: number, award: OrganizerPrize | null) => {
    setTeamAwards((prev) => {
      const next = { ...prev };

      if (!award) {
        delete next[teamId];
        return next;
      }

      if (award && (award.quantity ?? 1) <= 1) { // assuming quantity 1 means exclusive
        Object.entries(next).forEach(([id, existingAward]) => {
          if (Number(id) !== teamId && existingAward === award) {
            delete next[Number(id)];
          }
        });
      }

      next[teamId] = award;
      return next;
    });
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
              {round.isTrackSpecific !== false ? (
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

        {/* Publish Panel */}
        {round?.status === "closed" && (
          <GlassCard className="p-4 flex items-center gap-3 shrink-0">
            <Button
              onClick={() => setShowConfirmModal(true)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              disabled={round?.isFinalRound ? awardedCount === 0 : selectedTeamIds.size === 0}
            >
              <Send className="w-4 h-4" />
              Publish Results ({round?.isFinalRound ? awardedCount : selectedTeamIds.size} teams)
            </Button>
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
      {tracks.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-2 flex-wrap">
            {tracks.map((t, idx) => (
              <button
                key={t.track.id}
                onClick={() => setSelectedTrackIdx(idx)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                  idx === selectedTrackIdx
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {t.track.name}
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

      {/* Top-N Highlight Control */}
      {round?.status === "closed" && !round?.isFinalRound && (
        <div className="flex items-center justify-between bg-muted/30 p-3 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Auto-select Top</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setAutoSelectTopN(Math.max(1, autoSelectTopN - 1))} className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted font-bold bg-background">−</button>
              <span className="font-bold text-foreground w-5 text-center">{autoSelectTopN}</span>
              <button onClick={() => setAutoSelectTopN(autoSelectTopN + 1)} className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted font-bold bg-background">+</button>
            </div>
            <span>teams per track</span>
          </div>
          <Button variant="outline" onClick={handleAutoSelect} className="h-8 text-xs">
            Apply Auto-Select
          </Button>
        </div>
      )}

      {/* Prize Allocation Summary Bar (Final Round) */}
      {round?.isFinalRound && !isResultsPublished && (eventData?.prizes?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-card/80 p-4 rounded-2xl border border-border shadow-sm">
          <span className="text-sm font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Prize Allocation Status:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {eventData?.prizes?.map((prize) => {
              const assignedCount = Object.values(teamAwards).filter(a => a?.id === prize.id).length;
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
                  <span className="font-bold tabular-nums">{assignedCount} / {maxQty}</span>
                  {isFull ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <span className="text-[10px] opacity-75">({maxQty - assignedCount} left)</span>
                  )}
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
              ) : !isResultsPublished ? (
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Selected to Advance</span>
              ) : (
                <>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Passed (Advanced)</span>
                  <span className="flex items-center gap-1"><Minus className="w-3.5 h-3.5 text-red-500" /> Eliminated</span>
                </>
              )}
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
                Score variance (deviation ≥ {ANOMALY_THRESHOLD})
              </span>
              <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Above average</span>
              <span className="flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5 text-blue-400" /> Below average</span>
            </div>

            {entries.map((entry, idx) => (
              <TeamRow 
                key={entry.teamId} 
                entry={entry} 
                rank={entry.rank || idx + 1} 
                isSelected={selectedTeamIds.has(entry.teamId)}
                onToggle={() => handleToggleTeam(entry.teamId)}
                isPublished={isResultsPublished}
                isFinalRound={round?.isFinalRound}
                awardValue={teamAwards[entry.teamId]}
                onAwardChange={(val) => handleAwardChange(entry.teamId, val)}
                prizes={eventData?.prizes || []}
                teamAwards={teamAwards}
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
                    You have assigned awards to <strong>{awardedCount} team(s)</strong>.<br/><br/>
                    This action will finalize the official competition results. Are you sure you want to proceed?
                  </>
                ) : (
                  <>
                    You have selected <strong>{selectedTeamIds.size} team(s)</strong> to advance to the next round.
                    Remaining teams will be marked as <strong>Eliminated</strong>.<br/><br/>
                    This action cannot be undone and will send notification emails to all participants. Are you sure you want to proceed?
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
