"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { Check, Loader2, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  bulkCreateOrganizerRubrics,
  bulkDeleteOrganizerRubrics,
  suggestOrganizerRubrics,
  type OrganizerEvent,
  type OrganizerRound,
  type OrganizerRubric,
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

function BasedOnSummary({ basedOn }: { basedOn: SuggestRubricsResult["basedOn"] }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium text-foreground">Dựa trên:</p>
      <ul className="space-y-1.5 text-muted-foreground">
        <li>
          <span className="text-foreground/80">Sự kiện:</span> {basedOn.eventName}
        </li>
        <li>
          <span className="text-foreground/80">Vòng:</span> {basedOn.roundName}
        </li>
        {basedOn.tracks.length > 0 && (
          <li>
            <span className="text-foreground/80">Track:</span>{" "}
            {basedOn.tracks.map((t) => t.name).join(", ")}
          </li>
        )}
        {basedOn.problemStatements.length > 0 && (
          <li>
            <span className="text-foreground/80">Đề bài:</span>{" "}
            {basedOn.problemStatements
              .map((p) =>
                p.trackName ? `${p.label} (${p.trackName})` : p.label,
              )
              .join("; ")}
          </li>
        )}
        {basedOn.existingCriteria.length > 0 && (
          <li>
            <span className="text-foreground/80">Tiêu chí hiện có (tránh trùng):</span>{" "}
            {basedOn.existingCriteria.join(", ")}
          </li>
        )}
      </ul>
    </div>
  );
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

  const suggestMutation = useMutation({
    mutationFn: () => suggestOrganizerRubrics(event.id, round.id),
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "AI suggest failed"), {
        variant: "error",
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (data: SuggestRubricsResult) => {
      if (roundExisting.length > 0) {
        await bulkDeleteOrganizerRubrics(
          event.id,
          roundExisting.map((r) => r.id),
        );
      }

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
        `Applied ${criteria.length} selected AI-suggested criteria to this round`,
        { variant: "success" },
      );
      queryClient.invalidateQueries({
        queryKey: ["organizerRubrics", String(event.id)],
      });
      onOpenChange(false);
    },
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "Failed to apply rubrics"), {
        variant: "error",
      });
    },
  });

  const { mutate: runSuggest, isPending: isSuggesting, data: result, reset: resetSuggest } =
    suggestMutation;

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      resetSuggest();
      return;
    }

    if (startedRef.current || isSuggesting || result) return;
    startedRef.current = true;
    runSuggest();
  }, [open, isSuggesting, result, runSuggest, resetSuggest]);

  const busy = isSuggesting || applyMutation.isPending;

  const handleClose = () => {
    if (!busy) onOpenChange(false);
  };

  const handleReject = () => {
    enqueueSnackbar("AI suggestions discarded", { variant: "info" });
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles
              aria-hidden="true"
              className="h-5 w-5 text-orange-500"
            />
            Review AI Suggestions
          </DialogTitle>
          <DialogDescription>
            AI đọc tên sự kiện, track và đề bài để gợi ý rubric. Xem trước rồi
            chọn Đồng ý mới thêm xuống.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {isSuggesting && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-orange-500" />
              <div>
                <p className="font-medium text-foreground">
                  Đang tạo gợi ý rubric…
                </p>
                <p className="mt-1 text-xs">
                  Đọc thông tin sự kiện, vòng, track và đề bài.
                </p>
              </div>
            </div>
          )}

          {result && (
            <>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <BasedOnSummary basedOn={result.basedOn} />
                {result.overallRationale && (
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {result.overallRationale}
                  </p>
                )}
              </div>

              {roundExisting.length > 0 && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                  Nếu đồng ý, sẽ thay thế {roundExisting.length} tiêu chí hiện
                  có trong vòng này.
                </p>
              )}

              <div className="overflow-hidden rounded-xl border border-border">
                <div className="grid grid-cols-[1.2fr_0.5fr_2fr] gap-3 border-b border-border bg-muted/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Tiêu chí</span>
                  <span>Trọng số</span>
                  <span>Lý do chọn</span>
                </div>
                <div className="divide-y divide-border">
                  {result.criteria.map((item) => (
                    <div
                      key={item.name}
                      className="grid grid-cols-[1.2fr_0.5fr_2fr] gap-3 px-4 py-3 text-sm"
                    >
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      </div>
                      <div className="font-semibold text-orange-500">
                        {item.weight}%
                      </div>
                      <p className="text-muted-foreground">{item.whyChosen}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {result && !isSuggesting && (
          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={handleReject}
            >
              <X className="h-4 w-4" />
              Không dùng
            </Button>
            <Button
              type="button"
              variant="orange"
              className="rounded-xl"
              disabled={busy}
              onClick={() => applyMutation.mutate(result)}
            >
              {applyMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Đồng ý — thêm rubric
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
