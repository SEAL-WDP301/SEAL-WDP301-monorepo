"use client";

import { ExternalLink, FileText, Paperclip } from "lucide-react";
import { FaGithub as FaGithubIcon } from "react-icons/fa";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import type { JudgeSubmissionDetail } from "@/lib/api/judge.api";

interface SubmissionContentCardProps {
  detail?: JudgeSubmissionDetail | null;
  githubUrl?: string | null;
  fileUrl?: string | null;
  description?: string | null;
}

export function SubmissionContentCard({
  detail,
  githubUrl,
  fileUrl,
  description,
}: SubmissionContentCardProps) {
  const resolvedGithub = (detail?.githubUrl ?? githubUrl)?.trim();
  const resolvedFile = (detail?.fileUrl ?? fileUrl)?.trim();
  const resolvedDescription = (detail?.description ?? description)?.trim();

  const hasGithub = Boolean(resolvedGithub);
  const hasFile = Boolean(resolvedFile);
  const showBoth = hasGithub && hasFile;
  const submissionType =
    detail?.submissionType ?? detail?.round?.submissionType ?? null;
  const typeLabel =
    submissionType === "github_link"
      ? "GitHub"
      : submissionType === "file"
        ? "File"
        : null;

  return (
    <GlassCard className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Submission</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Content submitted by the team for this round
          </p>
        </div>
        {typeLabel && (
          <span className="shrink-0 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-500">
            {typeLabel}
          </span>
        )}
      </div>

      {hasGithub || hasFile ? (
        <div className={`grid gap-4 ${showBoth ? "md:grid-cols-2" : "grid-cols-1"}`}>
          {hasGithub && (
            <div className="rounded-2xl border border-white/10 bg-background/40 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-xl bg-primary/15 p-3">
                  <FaGithubIcon size={18} />
                </div>
                <div>
                  <h4 className="font-medium">GitHub Repository</h4>
                  <p className="text-xs text-muted-foreground">Provided Source code / repo</p>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground font-mono break-all line-clamp-2">
                  {resolvedGithub}
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href={resolvedGithub} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Source Code
                  </a>
                </Button>
              </div>
            </div>
          )}

          {hasFile && (
            <div className="rounded-2xl border border-white/10 bg-background/40 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-xl bg-primary/15 p-3">
                  <Paperclip size={18} />
                </div>
                <div>
                  <h4 className="font-medium">Document / File</h4>
                  <p className="text-xs text-muted-foreground">Slide, PDF, document</p>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground font-mono break-all line-clamp-2">
                  {resolvedFile}
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href={resolvedFile} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Document
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-background/40 p-4 text-sm text-muted-foreground">
          No attachment or GitHub link provided for this submission.
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-background/40 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-xl bg-primary/15 p-3">
            <FileText size={18} />
          </div>
          <div>
            <h4 className="font-medium">Project Description</h4>
            <p className="text-xs text-muted-foreground">Team notes</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {resolvedDescription || "Team has not provided a description."}
        </p>
      </div>
    </GlassCard>
  );
}
