"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { Loader2, Shuffle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  lotteryAssignProblemsToRound,
  type ProblemLotteryAssignment,
} from "@/lib/api/organizer-events.api";
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
  LotteryBoardAnimation,
  type LotteryBoardItem,
  type LotteryPreviewItem,
  type LotteryTrackSlot,
} from "./lottery-board-animation";

function getApiMessage(error: unknown, fallback: string) {
  const apiError = error as {
    response?: { data?: { message?: string; errors?: string[] } };
  };
  const errors = apiError.response?.data?.errors;
  if (Array.isArray(errors) && errors.length > 0) return errors.join(", ");
  return apiError.response?.data?.message || fallback;
}

function toBoardItems(assignments: ProblemLotteryAssignment[]): LotteryBoardItem[] {
  return assignments.map((a) => ({
    key: `p-${a.poolItemId}`,
    sourceLabel: a.label,
    trackId: a.trackId,
    trackName: a.trackName,
  }));
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  roundId: number;
  roundName: string;
  trackCount: number;
  trackSlots: LotteryTrackSlot[];
  previewItems: LotteryPreviewItem[];
  unassignedPoolCount: number;
  onComplete: () => void;
};

export function ProblemLotteryDialog({
  open,
  onOpenChange,
  eventId,
  roundId,
  roundName,
  trackCount,
  trackSlots,
  previewItems,
  unassignedPoolCount,
  onComplete,
}: Props) {
  const [phase, setPhase] = useState<"ready" | "spinning" | "reveal" | "done">(
    "ready",
  );
  const [assignments, setAssignments] = useState<ProblemLotteryAssignment[]>(
    [],
  );
  const [placedCount, setPlacedCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const boardItems = useMemo(() => toBoardItems(assignments), [assignments]);

  useEffect(() => {
    if (!open) {
      setPhase("ready");
      setAssignments([]);
      setPlacedCount(0);
      setLastError(null);
    }
  }, [open]);

  const lotteryMutation = useMutation({
    mutationFn: () => lotteryAssignProblemsToRound(eventId, roundId),
    onSuccess: (data) => {
      setLastError(null);
      setAssignments(data.assignments);
      setPlacedCount(0);
      setPhase("spinning");
      setTimeout(() => setPhase("reveal"), 1400);
    },
    onError: (error) => {
      const msg = getApiMessage(error, "Problem lottery failed");
      setLastError(msg);
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  useEffect(() => {
    if (phase !== "reveal" || boardItems.length === 0) return;
    if (placedCount >= boardItems.length) {
      const t = setTimeout(() => setPhase("done"), 700);
      return () => clearTimeout(t);
    }
    const delay = placedCount === 0 ? 500 : 900;
    const t = setTimeout(() => setPlacedCount((n) => n + 1), delay);
    return () => clearTimeout(t);
  }, [phase, placedCount, boardItems.length]);

  const handleClose = () => {
    onOpenChange(false);
    if (phase === "done") onComplete();
  };

  const canRun = trackCount > 0 && unassignedPoolCount >= trackCount;
  const boardPhase =
    phase === "done" ? "done" : phase === "spinning" ? "spinning" : phase;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-purple-500" />
            Random Track — Problem Lottery
          </DialogTitle>
          <DialogDescription>
            {roundName} · {trackCount} tracks — problems from pool fly to each track
            (show on projector).
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto py-2">
          <LotteryBoardAnimation
            mode="problem"
            phase={boardPhase}
            items={boardItems}
            placedCount={placedCount}
            trackSlots={trackSlots}
            previewItems={previewItems}
          />

          <AnimatePresence mode="wait">
            {phase === "spinning" && (
              <motion.p
                key="spinning-msg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 text-center text-sm font-medium text-muted-foreground"
              >
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-orange-500" />
                Shuffling and drawing...
              </motion.p>
            )}
            {phase === "done" && (
              <motion.p
                key="done-msg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 text-center text-sm font-semibold text-emerald-600"
              >
                Done! {boardItems.length} problems assigned to tracks.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-row sm:justify-between">
          {phase === "ready" ? (
            <p className="text-left text-xs text-muted-foreground sm:max-w-md">
              {lastError ? (
                <span className="text-red-500">{lastError}</span>
              ) : (
                <>
                  Need {trackCount} unassigned problems — currently have{" "}
                  <strong className="text-orange-600">{unassignedPoolCount}</strong>.
                </>
              )}
            </p>
          ) : (
            <span />
          )}
          <div className="flex gap-2 sm:ml-auto">
            {phase === "ready" ? (
              <Button
                type="button"
                size="lg"
                className="gap-2 bg-orange-600 hover:bg-orange-700"
                disabled={lotteryMutation.isPending || !canRun}
                onClick={() => lotteryMutation.mutate()}
              >
                {lotteryMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
                Draw Now
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (phase === "done") handleClose();
                else onOpenChange(false);
              }}
            >
              {phase === "done" ? "Close & refresh grid" : "Cancel"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
