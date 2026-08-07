"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  AlertTriangle,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

function normalizeCriteriaWeights(
  criteria: SuggestedRubricCriterion[],
): SuggestedRubricCriterion[] {
  if (criteria.length === 0) return [];

  const weightTotal = criteria.reduce(
    (total, criterion) => total + Number(criterion.weight),
    0,
  );
  if (weightTotal <= 0) return criteria;

  const normalized = criteria.map((criterion) => ({
    ...criterion,
    weight: Math.round((Number(criterion.weight) / weightTotal) * 1000) / 10,
  }));
  const normalizedTotal = normalized.reduce(
    (total, criterion) => total + criterion.weight,
    0,
  );
  const drift = Math.round((100 - normalizedTotal) * 10) / 10;

  normalized[normalized.length - 1].weight =
    Math.round((normalized[normalized.length - 1].weight + drift) * 10) / 10;

  return normalized;
}

export function AiSuggestRubricsModal({
  open,
  onOpenChange,
  event,
  round,
  existingRubrics,
}: Props) {
  const queryClient = useQueryClient();
  const startedRef = useRef(false);
  const [selectedCriteriaIndexes, setSelectedCriteriaIndexes] = useState<
    number[]
  >([]);

  const roundExisting = useMemo(
    () => existingRubrics.filter((r) => r.roundId === round.id),
    [existingRubrics, round.id],
  );

  const roundLabel = `Round ${round.roundNumber ?? ""}: ${round.name}`.replace(
    "Round :",
    "Round",
  );

  const suggestMutation = useMutation({
    mutationFn: () => suggestOrganizerRubrics(event.id, round.id),
    onSuccess: (data) => {
      setSelectedCriteriaIndexes(data.criteria.map((_, index) => index));
    },
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "AI suggest failed"), {
        variant: "error",
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const suggestion = suggestMutation.data;
      if (!suggestion) {
        throw new Error("Generate rubric suggestions before applying them.");
      }

      const selectedCriteria = selectedCriteriaIndexes
        .map((index) => suggestion.criteria[index])
        .filter((criterion): criterion is SuggestedRubricCriterion =>
          Boolean(criterion),
        );
      if (selectedCriteria.length === 0) {
        throw new Error("Select at least one rubric before applying.");
      }

      const criteriaToApply = normalizeCriteriaWeights(selectedCriteria);

      await bulkCreateOrganizerRubrics(event.id, {
        rubrics: criteriaToApply.map((criterion) => ({
          name: criterion.name,
          description: criterion.description,
          maxScore: 10,
          weight: criterion.weight,
          roundId: round.id,
          trackId: null,
        })),
      });

      return criteriaToApply;
    },
    onSuccess: (criteria) => {
      enqueueSnackbar(
        `Added ${criteria.length} new AI-suggested criteria to this round`,
        { variant: "success" },
      );
      queryClient.invalidateQueries({
        queryKey: ["organizerRubrics", String(event.id)],
      });
      onOpenChange(false);
    },
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "Failed to apply AI suggestions"), {
        variant: "error",
      });
    },
  });

  const {
    data: suggestion,
    error: suggestionError,
    isPending: isGenerating,
    mutate: runSuggest,
    reset: resetSuggestion,
  } = suggestMutation;
  const {
    isPending: isApplying,
    mutate: applySuggestion,
    reset: resetApply,
  } = applyMutation;
  const busy = isGenerating || isApplying;
  const selectedCriteria = useMemo(
    () =>
      normalizeCriteriaWeights(
        selectedCriteriaIndexes
          .map((index) => suggestion?.criteria[index])
          .filter((criterion): criterion is SuggestedRubricCriterion =>
            Boolean(criterion),
          ),
      ),
    [selectedCriteriaIndexes, suggestion],
  );
  const appliedWeightByIndex = useMemo(
    () =>
      new Map(
        selectedCriteriaIndexes.map((criterionIndex, selectedIndex) => [
          criterionIndex,
          selectedCriteria[selectedIndex]?.weight,
        ]),
      ),
    [selectedCriteria, selectedCriteriaIndexes],
  );
  const allCriteriaSelected = Boolean(
    suggestion?.criteria.length &&
      selectedCriteriaIndexes.length === suggestion.criteria.length,
  );

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      resetSuggestion();
      resetApply();
      return;
    }

    if (startedRef.current) return;
    startedRef.current = true;
    runSuggest();
  }, [open, resetApply, resetSuggestion, runSuggest]);

  const regenerate = () => {
    setSelectedCriteriaIndexes([]);
    resetSuggestion();
    runSuggest();
  };

  const toggleCriterion = (index: number) => {
    setSelectedCriteriaIndexes((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index].sort((a, b) => a - b),
    );
  };

  const toggleAllCriteria = () => {
    setSelectedCriteriaIndexes(
      allCriteriaSelected
        ? []
        : (suggestion?.criteria.map((_, index) => index) ?? []),
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isApplying) onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[min(90dvh,760px)] flex-col gap-0 overflow-hidden p-0 overscroll-contain sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-5 py-5 pr-14 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles
              aria-hidden="true"
              className="h-5 w-5 text-orange-500"
            />
            Review AI Suggestions
          </DialogTitle>
          <DialogDescription className="max-w-[60ch] text-pretty">
            Select the criteria you want to apply to {roundLabel}. Nothing is
            saved until you confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {isGenerating && (
            <div aria-live="polite" role="status">
              <p className="mb-4 text-sm font-medium text-foreground">
                Generating rubric suggestions…
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={index}
                    aria-hidden="true"
                    className="min-h-32 animate-pulse rounded-xl border border-border bg-muted/30 p-4 motion-reduce:animate-none"
                  >
                    <div className="h-4 w-2/3 rounded bg-muted" />
                    <div className="mt-4 h-3 w-full rounded bg-muted" />
                    <div className="mt-2 h-3 w-4/5 rounded bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {suggestionError && !isGenerating && (
            <div
              aria-live="polite"
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm"
            >
              <p className="font-semibold text-destructive">
                {getApiMessage(suggestionError, "Unable to generate suggestions")}
              </p>
              <p className="mt-1 text-muted-foreground">
                Check the event details, then try generating the suggestions
                again.
              </p>
              <Button
                className="mt-3"
                type="button"
                variant="outline"
                onClick={regenerate}
              >
                <RefreshCw aria-hidden="true" />
                Try Again
              </Button>
            </div>
          )}

          {suggestion && (
            <section aria-labelledby="suggested-rubrics-heading">
              <div className="mb-4 rounded-xl border border-border bg-muted/20 p-4">
                <dl className="grid gap-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4 sm:gap-y-2">
                  <dt className="font-medium text-muted-foreground">Event</dt>
                  <dd className="font-medium text-foreground">
                    {suggestion.basedOn.eventName}
                  </dd>
                  <dt className="font-medium text-muted-foreground">Round</dt>
                  <dd className="font-medium text-foreground">
                    {suggestion.basedOn.roundName}
                  </dd>
                  <dt className="font-medium text-muted-foreground">
                    {suggestion.basedOn.tracks.length === 1 ? "Track" : "Tracks"}
                  </dt>
                  <dd className="flex flex-wrap gap-2">
                    {suggestion.basedOn.tracks.length > 0 ? (
                      suggestion.basedOn.tracks.map((track) => (
                        <span
                          key={track.name}
                          className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-700 dark:text-orange-300"
                          title={track.description || undefined}
                        >
                          {track.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-foreground">
                        {round.isTrackSpecific
                          ? "No tracks assigned"
                          : "All Tracks (Shared Round)"}
                      </span>
                    )}
                  </dd>
                </dl>
              </div>

              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2
                    id="suggested-rubrics-heading"
                    className="font-semibold text-foreground"
                  >
                    Choose Rubrics
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedCriteria.length} of {suggestion.criteria.length}{" "}
                    selected. Applied weights always total 100%.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isApplying}
                    onClick={toggleAllCriteria}
                  >
                    {allCriteriaSelected ? "Clear Selection" : "Select All"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={regenerate}
                  >
                    <RefreshCw aria-hidden="true" />
                    Regenerate
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {suggestion.criteria.map((criterion, index) => {
                  const isSelected = selectedCriteriaIndexes.includes(index);

                  return (
                    <label
                      key={`${criterion.name}-${index}`}
                      className={`group flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-4 transition-[border-color,background-color,box-shadow] duration-200 focus-within:ring-2 focus-within:ring-orange-500/40 focus-within:ring-offset-2 focus-within:ring-offset-background active:translate-y-px ${
                        isSelected
                          ? "border-orange-500/60 bg-orange-500/[0.06] shadow-sm"
                          : "border-border bg-muted/20 hover:border-foreground/25 hover:bg-muted/40"
                      } ${isApplying ? "pointer-events-none opacity-70" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 accent-orange-500 focus-visible:outline-none"
                        checked={isSelected}
                        disabled={isApplying}
                        onChange={() => toggleCriterion(index)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="break-words font-semibold leading-5 text-foreground">
                            {criterion.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-sm font-semibold text-foreground">
                            {isSelected
                              ? `${appliedWeightByIndex.get(index) ?? 0}%`
                              : "Skip"}
                          </span>
                        </span>
                        <span className="mt-1.5 line-clamp-3 break-words text-sm leading-5 text-muted-foreground">
                          {criterion.description}
                        </span>
                        {criterion.whyChosen && (
                          <span className="mt-3 block line-clamp-2 border-l-2 border-border pl-3 text-xs leading-4 text-muted-foreground">
                            {criterion.whyChosen}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>

              {suggestion.overallRationale && (
                <details className="mt-4 rounded-lg bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40">
                    Why These Rubrics?
                  </summary>
                  <p className="mt-2 max-w-[70ch] text-pretty leading-5">
                    {suggestion.overallRationale}
                  </p>
                </details>
              )}
            </section>
          )}
        </div>

        <DialogFooter className="m-0 shrink-0 flex-col items-stretch rounded-none px-4 py-4 sm:flex-row sm:items-center sm:px-6">
          <div
            aria-live="polite"
            className="min-w-0 text-left sm:mr-auto"
          >
            <p className="text-sm font-medium text-foreground">
              {isGenerating
                ? "Preparing suggestions…"
                : suggestionError
                  ? "Suggestions unavailable"
                  : `${selectedCriteria.length} rubric${
                      selectedCriteria.length === 1 ? "" : "s"
                    } selected`}
            </p>
            {roundExisting.length > 0 && suggestion && (
              <p className="mt-1 flex items-start gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                <Sparkles
                  aria-hidden="true"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                />
                Will add {selectedCriteria.length} new rubric
                {selectedCriteria.length === 1 ? "" : "s"} ({roundExisting.length} existing rubric
                {roundExisting.length === 1 ? "" : "s"} preserved).
              </p>
            )}
          </div>

          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              className="flex-1 sm:flex-none"
              type="button"
              variant="outline"
              disabled={isApplying}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              type="button"
              disabled={
                !suggestion || selectedCriteria.length === 0 || isApplying
              }
              onClick={() => applySuggestion()}
            >
              {isApplying ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <Check aria-hidden="true" />
              )}
              {isApplying
                ? "Applying…"
                : suggestion
                  ? `Apply ${selectedCriteria.length} Rubric${
                      selectedCriteria.length === 1 ? "" : "s"
                    }`
                  : "Apply Selected"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
