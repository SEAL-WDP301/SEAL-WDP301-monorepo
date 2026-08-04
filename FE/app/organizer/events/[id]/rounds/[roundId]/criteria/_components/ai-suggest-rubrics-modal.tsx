"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  bulkCreateOrganizerRubrics,
  bulkDeleteOrganizerRubrics,
  suggestOrganizerRubrics,
  type OrganizerEvent,
  type OrganizerRound,
  type OrganizerRubric,
  type SuggestedRubricCriterion,
  type SuggestRubricsResult,
} from "@/lib/api/organizer-events.api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: OrganizerEvent;
  round: OrganizerRound;
  existingRubrics: OrganizerRubric[];
};

function getApiMessage(error: unknown, fallback: string) {
  const apiError = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return apiError.response?.data?.message || apiError.message || fallback;
}

export function AiSuggestRubricsModal({
  open,
  onOpenChange,
  event,
  round,
  existingRubrics,
}: Props) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<SuggestRubricsResult | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [replaceExisting, setReplaceExisting] = useState(true);

  const roundExisting = useMemo(
    () => existingRubrics.filter((r) => r.roundId === round.id),
    [existingRubrics, round.id],
  );

  useEffect(() => {
    if (!open) {
      setResult(null);
      setSelected({});
      setReplaceExisting(true);
    } else {
      setReplaceExisting(roundExisting.length > 0);
    }
  }, [open, roundExisting.length]);

  const suggestMutation = useMutation({
    mutationFn: () => suggestOrganizerRubrics(event.id, round.id),
    onSuccess: (data) => {
      setResult(data);
      const next: Record<number, boolean> = {};
      data.criteria.forEach((_, i) => {
        next[i] = true;
      });
      setSelected(next);
    },
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "AI suggest failed"), {
        variant: "error",
      });
    },
  });

  const selectedCriteria = useMemo(() => {
    if (!result) return [] as SuggestedRubricCriterion[];
    return result.criteria.filter((_, i) => selected[i]);
  }, [result, selected]);

  const selectedWeight = selectedCriteria.reduce(
    (sum, c) => sum + Number(c.weight || 0),
    0,
  );
  const existingWeight = roundExisting.reduce(
    (sum, r) => sum + Number(r.weight || 0),
    0,
  );
  const projectedWeight = replaceExisting
    ? selectedWeight
    : existingWeight + selectedWeight;
  const overBudget = projectedWeight > 100.01;

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCriteria.length) {
        throw new Error("Select at least one suggested criterion.");
      }
      if (overBudget) {
        throw new Error(
          replaceExisting
            ? `Selected weights total ${projectedWeight.toFixed(2)}% (max 100%).`
            : `Would be ${projectedWeight.toFixed(2)}%. Enable Replace existing.`,
        );
      }

      if (replaceExisting && roundExisting.length > 0) {
        await bulkDeleteOrganizerRubrics(
          event.id,
          roundExisting.map((r) => r.id),
        );
      }

      return bulkCreateOrganizerRubrics(event.id, {
        rubrics: selectedCriteria.map((c) => ({
          name: c.name,
          description: c.description,
          maxScore: 10,
          weight: c.weight,
          roundId: round.id,
          trackId: null,
        })),
      });
    },
    onSuccess: () => {
      enqueueSnackbar(
        replaceExisting
          ? `Replaced rubric with ${selectedCriteria.length} suggestion(s)`
          : `Added ${selectedCriteria.length} suggestion(s)`,
        { variant: "success" },
      );
      queryClient.invalidateQueries({
        queryKey: ["organizerRubrics", String(event.id)],
      });
      onOpenChange(false);
    },
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "Failed to apply suggestions"), {
        variant: "error",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            AI Suggest Rubrics
          </DialogTitle>
          <DialogDescription>
            Drafts a 100% rubric for this round from event name, tracks, and đề.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {!result && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              {roundExisting.length > 0 && (
                <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-300">
                  This round already has {roundExisting.length} criteria (
                  {existingWeight.toFixed(2)}%). Prefer Replace after generate.
                </p>
              )}
              <Button
                className="gap-2 bg-orange-600 hover:bg-orange-700"
                disabled={suggestMutation.isPending}
                onClick={() => suggestMutation.mutate()}
              >
                {suggestMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate suggestions
              </Button>
            </div>
          )}

          {suggestMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Drafting rubrics…
            </div>
          )}

          {result && (
            <>
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
                <p className="font-semibold text-foreground">
                  {result.basedOn.roundName} · {result.basedOn.eventName}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                  {result.overallRationale}
                </p>
              </div>

              {roundExisting.length > 0 && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/60 p-4">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                  />
                  <span className="text-sm">
                    <span className="font-semibold text-foreground">
                      Replace existing ({roundExisting.length})
                    </span>
                  </span>
                </label>
              )}

              <div className="space-y-3">
                {result.criteria.map((c, index) => (
                  <label
                    key={`${c.name}-${index}`}
                    className="flex cursor-pointer gap-3 rounded-xl border border-border bg-background/60 p-4 hover:bg-muted/20"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={Boolean(selected[index])}
                      onChange={(e) =>
                        setSelected((prev) => ({
                          ...prev,
                          [index]: e.target.checked,
                        }))
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{c.name}</p>
                        <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-600">
                          {c.weight}%
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {c.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <div
                className={`rounded-xl border px-3 py-2 text-xs ${
                  overBudget
                    ? "border-red-500/30 bg-red-500/10 text-red-600"
                    : Math.abs(projectedWeight - 100) <= 0.01
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                      : "border-border bg-muted/30 text-muted-foreground"
                }`}
              >
                Projected:{" "}
                <strong>{projectedWeight.toFixed(2)}% / 100%</strong>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {result && (
            <>
              <Button
                variant="outline"
                disabled={suggestMutation.isPending}
                onClick={() => suggestMutation.mutate()}
              >
                Regenerate
              </Button>
              <Button
                className="gap-2 bg-orange-600 hover:bg-orange-700"
                disabled={
                  applyMutation.isPending ||
                  selectedCriteria.length === 0 ||
                  overBudget
                }
                onClick={() => applyMutation.mutate()}
              >
                {applyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {replaceExisting
                  ? `Replace (${selectedCriteria.length})`
                  : `Add (${selectedCriteria.length})`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
