"use client";

import { Check, Info, Loader2, Sparkles, X } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import type { MentorAiDraftResult } from "@/lib/api/mentor.api";

interface Props {
  draft: MentorAiDraftResult | null;
  isLoading?: boolean;
  disabled?: boolean;
  onGenerate?: () => void;
  onUseDraft?: (text: string) => void;
  onDismiss?: () => void;
}

function readinessClass(value: MentorAiDraftResult["readiness"]) {
  if (value === "strong") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  if (value === "at_risk") return "bg-red-500/10 text-red-400 border-red-500/30";
  if (value === "no_submission")
    return "bg-muted text-muted-foreground border-border";
  return "bg-amber-500/10 text-amber-400 border-amber-500/30";
}

export function AiMentorDraftPanel({
  draft,
  isLoading,
  disabled,
  onGenerate,
  onUseDraft,
  onDismiss,
}: Props) {
  const sourceLabel =
    draft?.source === "github_link"
      ? "GitHub"
      : draft?.source === "file"
        ? "File"
        : null;

  return (
    <GlassCard className="rounded-[24px] border border-orange-500/20 bg-card p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            <h3 className="text-lg font-semibold">AI Mentoring Assist</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Quick overview + draft feedback so you can decide fast, then edit
            before submitting.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={disabled || isLoading || !onGenerate}
          onClick={onGenerate}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {draft ? "Regenerate" : "Draft with AI"}
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-3 text-sm text-orange-100">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
        <p className="text-xs leading-relaxed text-orange-100/80">
          Coaching assist only — not judging scores. Review before using the
          draft. AI may miss repo/file details.
        </p>
      </div>

      {isLoading && !draft && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
          Reading submission and drafting a mentoring brief…
        </div>
      )}

      {draft && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {sourceLabel && (
              <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 font-bold uppercase tracking-wider text-orange-500">
                {sourceLabel}
              </span>
            )}
            <span
              className={`rounded-full border px-2.5 py-1 font-bold uppercase tracking-wider ${readinessClass(draft.readiness)}`}
            >
              {draft.readiness.replace(/_/g, " ")}
            </span>
            {draft.contextSummary && (
              <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 font-medium text-muted-foreground">
                Evidence: {draft.contextSummary}
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Overview
            </p>
            <p className="mt-2 text-sm leading-relaxed">{draft.overview}</p>
            <p className="mt-3 text-sm text-orange-400">
              Decide: {draft.focusNext}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Strengths
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {draft.strengths.length ? (
                  draft.strengths.map((item) => (
                    <li key={item}>• {item}</li>
                  ))
                ) : (
                  <li className="text-muted-foreground">None highlighted</li>
                )}
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Risks / gaps
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {draft.risks.length ? (
                  draft.risks.map((item) => <li key={item}>• {item}</li>)
                ) : (
                  <li className="text-muted-foreground">None highlighted</li>
                )}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Questions to ask the team
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {draft.questionsToAsk.length ? (
                draft.questionsToAsk.map((item) => (
                  <li key={item}>• {item}</li>
                ))
              ) : (
                <li className="text-muted-foreground">No questions drafted</li>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Draft feedback
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
              {draft.draftFeedback}
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {onDismiss && (
              <Button type="button" variant="outline" onClick={onDismiss}>
                <X className="h-4 w-4" />
                Dismiss
              </Button>
            )}
            {onUseDraft && (
              <Button
                type="button"
                variant="orange"
                className="rounded-xl"
                onClick={() => onUseDraft(draft.draftFeedback)}
              >
                <Check className="h-4 w-4" />
                Use draft in editor
              </Button>
            )}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
