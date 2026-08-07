"use client";

import React from "react";
import Link from "next/link";
import { 
  Sparkles, 
  Trophy, 
  PartyPopper, 
  HeartHandshake, 
  Clock, 
  ArrowRight, 
  Medal, 
  CheckCircle2,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getScoreColorClass } from "@/lib/api/judge.api";

export interface TeamRoundStatusBannerProps {
  roundName?: string;
  roundStatus?: string; // "not_started" | "open" | "closed" | "results_published"
  teamRoundStatus?: string | null;
  score?: any;
  isFinalRound?: boolean;
  eventStatus?: string;
  award?: {
    id?: number;
    name?: string;
    description?: string;
  } | string | null;
  nextRoundId?: number | null;
  nextRoundName?: string | null;
  basePath?: string;
  isOverview?: boolean;
  onNavigateNext?: () => void;
}

function getAwardTier(awardName: string = "") {
  const lower = awardName.toLowerCase();

  // 1st Place / Champion / Gold
  if (
    lower.includes("first") ||
    lower.includes("1st") ||
    lower.includes("champion") ||
    lower.includes("grand") ||
    lower.includes("gold") ||
    lower.includes("nhất")
  ) {
    return {
      badgeText: "🥇 1ST PLACE WINNER",
      badgeClass: "bg-yellow-500 text-black font-extrabold",
      iconContainerClass: "bg-yellow-500/20 border-yellow-500/40 text-yellow-500",
      cardBorderClass: "border-2 border-yellow-500/50 bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-orange-500/20 shadow-[0_0_35px_rgba(234,179,8,0.25)]",
      scoreTextClass: "text-yellow-600 dark:text-yellow-400",
      icon: <Trophy className="h-8 w-8 text-yellow-500 animate-bounce" />,
    };
  }

  // 2nd Place / Silver / Runner-up
  if (
    lower.includes("second") ||
    lower.includes("2nd") ||
    lower.includes("runner") ||
    lower.includes("silver") ||
    lower.includes("nhì")
  ) {
    return {
      badgeText: "🥈 2ND PLACE WINNER",
      badgeClass: "bg-slate-300 text-black font-extrabold dark:bg-slate-200",
      iconContainerClass: "bg-slate-300/20 border-slate-300/40 text-slate-300 dark:text-slate-200",
      cardBorderClass: "border-2 border-slate-400/50 bg-gradient-to-r from-slate-400/20 via-zinc-300/15 to-slate-500/20 shadow-[0_0_35px_rgba(148,163,184,0.25)]",
      scoreTextClass: "text-slate-300 dark:text-slate-200",
      icon: <Medal className="h-8 w-8 text-slate-300 dark:text-slate-200 animate-bounce" />,
    };
  }

  // 3rd Place / Bronze
  if (
    lower.includes("third") ||
    lower.includes("3rd") ||
    lower.includes("bronze") ||
    lower.includes("ba")
  ) {
    return {
      badgeText: "🥉 3RD PLACE WINNER",
      badgeClass: "bg-amber-700 text-white font-extrabold dark:bg-amber-600",
      iconContainerClass: "bg-amber-700/20 border-amber-600/40 text-amber-600 dark:text-amber-400",
      cardBorderClass: "border-2 border-amber-600/50 bg-gradient-to-r from-amber-700/20 via-orange-600/15 to-amber-800/20 shadow-[0_0_35px_rgba(180,83,9,0.25)]",
      scoreTextClass: "text-amber-600 dark:text-amber-400",
      icon: <Medal className="h-8 w-8 text-amber-600 dark:text-amber-400 animate-bounce" />,
    };
  }

  // Special / Honorable Mention
  return {
    badgeText: "🎖️ OFFICIAL AWARD WINNER",
    badgeClass: "bg-purple-600 text-white font-extrabold",
    iconContainerClass: "bg-purple-500/20 border-purple-500/40 text-purple-400",
    cardBorderClass: "border-2 border-purple-500/50 bg-gradient-to-r from-purple-500/20 via-indigo-500/15 to-pink-500/20 shadow-[0_0_35px_rgba(168,85,247,0.25)]",
    scoreTextClass: "text-purple-400",
    icon: <Award className="h-8 w-8 text-purple-400 animate-bounce" />,
  };
}

export function TeamRoundStatusBanner({
  roundName = "Round",
  roundStatus,
  teamRoundStatus,
  score,
  isFinalRound = false,
  eventStatus,
  award,
  nextRoundId,
  nextRoundName,
  basePath,
  isOverview = false,
  onNavigateNext,
}: TeamRoundStatusBannerProps) {
  // Is results published for this round or event is closed
  const isResultsPublished = roundStatus === "results_published" || eventStatus === "closed";

  const awardName = typeof award === "string" ? award : award?.name;
  const awardDescription = typeof award === "object" ? award?.description : undefined;
  const hasAward = !!awardName || (!!award && typeof award === "object" && !!(award as any).id);

  // If results are not published yet, but round is closed (Evaluation phase)
  if (roundStatus === "closed" && !isResultsPublished) {
    return (
      <div className="relative overflow-hidden rounded-[24px] border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <Clock className="h-6 w-6 text-cyan-500 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="border-cyan-500/40 text-cyan-500 text-[10px] uppercase font-bold tracking-wider">
                  EVALUATION IN PROGRESS
                </Badge>
                <span className="text-xs text-muted-foreground">• {roundName}</span>
              </div>
              <h3 className="text-lg font-bold text-foreground">
                ⏳ Judges are evaluating submissions for {roundName}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                The submission deadline for this round has ended. Official results will be published soon!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If results are NOT published yet and no special state, do not show result banner
  if (!isResultsPublished) {
    return null;
  }

  // ── CASE 1: ADVANCED (Passed to next round) ─────────────────────────────
  if (teamRoundStatus === "advanced") {
    return (
      <div className="relative overflow-hidden rounded-[24px] border border-orange-500/40 bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-yellow-500/15 p-6 shadow-[0_0_25px_-5px_rgba(249,115,22,0.25)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shrink-0 shadow-lg text-white">
              <PartyPopper className="h-7 w-7 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5">
                  ✨ PASSED ROUND
                </Badge>
                {score !== null && score !== undefined && (
                  <span className={cn("text-xs font-bold tabular-nums", getScoreColorClass(score))}>
                    Score: {Number(score).toFixed(2)}/10
                  </span>
                )}
              </div>
              <h3 className="text-xl font-extrabold text-foreground">
                🎉 Congratulations! Your team passed {roundName}!
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {nextRoundName
                  ? `Judge evaluation results qualified your team for ${nextRoundName}. Get ready for the next challenge!`
                  : "Judge evaluation results have been officially published. Your team qualified for the next round!"}
              </p>
            </div>
          </div>

          {/* Navigation Action */}
          {nextRoundId && (
            <div className="shrink-0 w-full md:w-auto">
              {onNavigateNext ? (
                <Button onClick={onNavigateNext} variant="orange" size="lg" className="w-full md:w-auto rounded-xl gap-2 font-bold shadow-md">
                  Proceed to {nextRoundName || "Next Round"} <ArrowRight className="h-4 w-4" />
                </Button>
              ) : basePath ? (
                <Button variant="orange" size="lg" asChild className="w-full md:w-auto rounded-xl gap-2 font-bold shadow-md">
                  <Link href={`${basePath}?roundId=${nextRoundId}`}>
                    Proceed to {nextRoundName || "Next Round"} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── CASE 2: ELIMINATED ─────────────────────────────────────────
  if (teamRoundStatus === "eliminated") {
    return (
      <div className="relative overflow-hidden rounded-[24px] border border-red-500/30 bg-gradient-to-r from-red-500/10 via-zinc-900/10 to-muted/20 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0 text-red-500">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="destructive" className="font-bold text-[10px] uppercase tracking-wider">
                  ELIMINATED AT {roundName.toUpperCase()}
                </Badge>
                {score !== null && score !== undefined && (
                  <span className={cn("text-xs font-bold tabular-nums", getScoreColorClass(score))}>
                    Score: {Number(score).toFixed(2)}/10
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Organizers Regret — Your team ended its journey at {roundName}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your team&apos;s journey at SEAL Hackathon has concluded. We are immensely proud of your hard work and project. Thank you for your dedication!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── CASE 3: FINAL ROUND ──────────────────────────────────
  if (isFinalRound) {
    if (hasAward) {
      const tierConfig = getAwardTier(awardName || "");
      return (
        <div className={`relative overflow-hidden rounded-[24px] p-6 ${tierConfig.cardBorderClass}`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 border ${tierConfig.iconContainerClass}`}>
                {tierConfig.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`text-[10px] uppercase tracking-wider px-2.5 py-0.5 ${tierConfig.badgeClass}`}>
                    {tierConfig.badgeText}
                  </Badge>
                  {score !== null && score !== undefined && (
                    <span className={cn("text-xs font-bold tabular-nums", getScoreColorClass(score))}>
                      Final Score: {Number(score).toFixed(2)}/10
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-extrabold text-foreground">
                  🎉 CONGRATULATIONS! YOUR TEAM WON: {awardName || "OFFICIAL AWARD"}!
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {awardDescription || "Your outstanding performance and project have been honored at SEAL Hackathon 2026!"}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="relative overflow-hidden rounded-[24px] border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-orange-500/10 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center shrink-0 text-yellow-600 dark:text-yellow-400">
              <Medal className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="border-yellow-500/40 text-yellow-600 dark:text-yellow-400 text-[10px] font-bold uppercase tracking-wider">
                  FINALIST COMPLETED
                </Badge>
                {score !== null && score !== undefined && (
                  <span className={cn("text-xs font-bold tabular-nums", getScoreColorClass(score))}>
                    Final Score: {Number(score).toFixed(2)}/10
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-foreground">
                👏 Congratulations! Your team successfully completed the Final Round!
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your team is one of the top finalists in this competition. Thank you for creating incredible impact!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default fallback if round is completed
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-orange-500" />
        <div>
          <span className="font-semibold text-foreground">{roundName}</span>
          <span className="text-xs text-muted-foreground ml-2">— Results Published</span>
        </div>
      </div>
    </div>
  );
}
