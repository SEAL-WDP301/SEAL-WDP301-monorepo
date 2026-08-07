"use client";

import { AlertCircle } from "lucide-react";

type Props = {
  lockReason?: string | null;
  teamStatus?: string;
  fallbackTitle?: string;
  fallbackMessage?: string;
};

export function SubmissionLockBanner({
  lockReason,
  teamStatus,
  fallbackTitle = "Submission unavailable",
  fallbackMessage = "The organizer must approve your team before you can submit.",
}: Props) {
  const showFallback = !lockReason && teamStatus !== "approved";

  if (!lockReason && !showFallback) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-2xl flex items-start gap-3">
      <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
      <div>
        <h4 className="font-semibold text-sm">
          {lockReason ? "Submission not available yet" : fallbackTitle}
        </h4>
        <p className="text-sm mt-1 opacity-90">
          {lockReason ?? fallbackMessage}
        </p>
      </div>
    </div>
  );
}
