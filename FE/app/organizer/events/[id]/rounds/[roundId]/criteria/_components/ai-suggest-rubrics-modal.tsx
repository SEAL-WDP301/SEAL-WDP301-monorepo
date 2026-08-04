"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { Loader2, Sparkles } from "lucide-react";

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

function getRoundTrackNames(event: OrganizerEvent, round: OrganizerRound): string[] {
  const catalog = event.tracks ?? [];
  const trackIds = round.trackProblems?.map((tp) => tp.trackId) ?? [];

  if (trackIds.length > 0) {
    return trackIds
      .map((id) => catalog.find((track) => track.id === id)?.name)
      .filter((name): name is string => Boolean(name));
  }

  return catalog.map((track) => track.name).filter(Boolean);
}

function buildIntroCopy(
  eventName: string,
  roundName: string,
  trackNames: string[],
): string {
  const trackLine =
    trackNames.length > 0
      ? `Track themes in this round: ${trackNames.join(", ")}.`
      : "Track themes will be inferred from the round setup.";

  return `Based on the event "${eventName}" (${roundName}), ${trackLine} Here are suggested grading criteria for judges:`;
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

  const roundExisting = useMemo(
    () => existingRubrics.filter((r) => r.roundId === round.id),
    [existingRubrics, round.id],
  );

  const trackNames = useMemo(
    () => getRoundTrackNames(event, round),
    [event, round],
  );

  const roundLabel = `Round ${round.roundNumber ?? ""}: ${round.name}`.replace(
    "Round :",
    "Round",
  );

  const introCopy = buildIntroCopy(event.name, roundLabel, trackNames);

  const suggestAndApplyMutation = useMutation({
    mutationFn: async () => {
      const data = await suggestOrganizerRubrics(event.id, round.id);

      if (roundExisting.length > 0) {
        await bulkDeleteOrganizerRubrics(
          event.id,
          roundExisting.map((r) => r.id),
        );
      }

      await bulkCreateOrganizerRubrics(event.id, {
        rubrics: data.criteria.map((c) => ({
          name: c.name,
          description: c.description,
          maxScore: 10,
          weight: c.weight,
          roundId: round.id,
          trackId: null,
        })),
      });

      return data;
    },
    onSuccess: (data) => {
      enqueueSnackbar(
        `Applied ${data.criteria.length} AI-suggested criteria to this round`,
        { variant: "success" },
      );
      queryClient.invalidateQueries({
        queryKey: ["organizerRubrics", String(event.id)],
      });
      onOpenChange(false);
    },
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "AI suggest failed"), {
        variant: "error",
      });
    },
  });

  const { mutate: runSuggestAndApply, isPending: busy } =
    suggestAndApplyMutation;

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      return;
    }

    if (startedRef.current || busy) return;
    startedRef.current = true;
    runSuggestAndApply();
  }, [open, busy, runSuggestAndApply]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            AI Suggest Rubrics
          </DialogTitle>
          <DialogDescription>
            Generates and applies a 100% rubric for this round from the event
            name, tracks, and problem statements.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm leading-relaxed text-foreground/90">
            <p>{introCopy}</p>
            {suggestAndApplyMutation.data?.overallRationale && (
              <p className="mt-3 text-muted-foreground">
                {suggestAndApplyMutation.data.overallRationale}
              </p>
            )}
          </div>

          {roundExisting.length > 0 && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              Replacing {roundExisting.length} existing criteria in this round…
            </p>
          )}

          <div className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-orange-500" />
            <div>
              <p className="font-medium text-foreground">
                {busy ? "Generating and applying rubrics…" : "Done"}
              </p>
              <p className="mt-1 text-xs">
                AI is drafting criteria grounded in your event, round, and track
                themes. They will be saved automatically when ready.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
