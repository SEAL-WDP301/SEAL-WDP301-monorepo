"use client";

import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";

import { GlassCard } from "@/components/ui/glass-card";
import { useJudgeWorkspace } from "@/lib/hooks/use-judge-workspace";

export function QuickSubmission() {
  const params = useParams();
  const { pendingSubmissions, submissions, isLoading } = useJudgeWorkspace(params.eventId as string);

  const focus =
    pendingSubmissions[0] ??
    submissions.find((item) => item.githubUrl) ??
    submissions[0];

  if (isLoading) {
    return (
      <GlassCard className="flex h-40 items-center justify-center p-5">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </GlassCard>
    );
  }

  if (!focus) {
    return (
      <GlassCard className="p-5">
        <h2 className="mb-2 text-lg font-semibold">Quick Submission Access</h2>
        <p className="text-sm text-muted-foreground">
          No submissions are available. Open the Evaluation workspace after a team submits its work.
        </p>
      </GlassCard>
    );
  }

  const githubUrl = focus.githubUrl;
  const shortcuts = [
    githubUrl
      ? {
          icon: FaGithub,
          label: "GitHub Repo",
          desc: githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//, ""),
          href: githubUrl,
        }
      : null,
    {
      icon: FileText,
      label: focus.teamName,
      desc: `${focus.eventName} · ${focus.roundName}`,
      href: `/judge/events/${params.eventId}/evalution?roundId=${focus.roundId}`,
      internal: true,
    },
  ].filter(Boolean) as Array<{
    icon: typeof FaGithub;
    label: string;
    desc: string;
    href: string;
    internal?: boolean;
  }>;

  return (
    <GlassCard className="p-5">
      <h2 className="mb-1 text-lg font-semibold">Quick Submission Access</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        {focus.scoringStatus === "in_review"
          ? "Continue current evaluation"
          : "Open next submission"}
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {shortcuts.map((item) => {
          const content = (
            <>
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary transition group-hover:glow-orange-sm">
                <item.icon size={18} />
              </div>

              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{item.label}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {item.desc}
                </div>
              </div>

              {!item.internal && (
                <ExternalLink className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </>
          );

          return item.internal ? (
            <motion.a
              key={item.label}
              href={item.href}
              whileHover={{ y: -2 }}
              className="group flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3.5 text-left transition hover:border-primary/40 hover:bg-card/70"
            >
              {content}
            </motion.a>
          ) : (
            <motion.a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ y: -2 }}
              className="group flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3.5 text-left transition hover:border-primary/40 hover:bg-card/70"
            >
              {content}
            </motion.a>
          );
        })}
      </div>
    </GlassCard>
  );
}
