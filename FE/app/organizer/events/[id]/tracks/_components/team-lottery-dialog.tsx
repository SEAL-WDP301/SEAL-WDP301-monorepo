"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { Loader2, Sparkles, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  closeStudentTrackDraw,
  getStudentTrackDrawStatus,
  revealEventTracks,
  type TeamLotteryAssignment,
} from "@/lib/api/organizer-events.api";
import { axiosClient } from "@/lib/axios";
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

function toBoardItems(assignments: TeamLotteryAssignment[]): LotteryBoardItem[] {
  return assignments.map((a) => ({
    key: `t-${a.teamId}`,
    sourceLabel: a.teamName,
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
  /** Resume live student-draw session if already open. */
  studentTrackDrawOpen?: boolean;
  onComplete: () => void;
};

export function TeamLotteryDialog({
  open,
  onOpenChange,
  eventId,
  roundId,
  roundName,
  trackCount,
  trackSlots,
  studentTrackDrawOpen = false,
  onComplete,
}: Props) {
  const [phase, setPhase] = useState<
    "ready" | "spinning" | "reveal" | "done" | "student_live"
  >("ready");
  const [assignments, setAssignments] = useState<TeamLotteryAssignment[]>([]);
  const [skippedAlreadyAssigned, setSkippedAlreadyAssigned] = useState(0);
  const [placedCount, setPlacedCount] = useState(0);
  const [drawOpen, setDrawOpen] = useState(studentTrackDrawOpen);
  const [wantStudentSelfDraw, setWantStudentSelfDraw] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const teamsPreviewQuery = useQuery({
    queryKey: ["lotteryTeamsPreview", eventId],
    queryFn: async () => {
      const res = await axiosClient.get(
        `/organizer/teams/events/${eventId}?limit=500`,
      );
      return (res.data?.data ?? []) as Array<{
        id: number;
        name: string;
        trackId?: number | null;
        status?: string;
      }>;
    },
    enabled: open,
  });

  const eligibleTeams = useMemo(
    () =>
      (teamsPreviewQuery.data ?? []).filter(
        (team) =>
          team.trackId == null &&
          (team.status === "approved" || team.status === "pending"),
      ),
    [teamsPreviewQuery.data],
  );

  const liveDrawQuery = useQuery({
    queryKey: ["studentTrackDrawStatus", eventId, roundId],
    queryFn: () => getStudentTrackDrawStatus(eventId, roundId),
    enabled: open && drawOpen,
    refetchInterval: drawOpen ? 2500 : false,
  });

  useEffect(() => {
    if (!liveDrawQuery.data || !drawOpen) return;
    setAssignments(liveDrawQuery.data.assignments ?? []);
    setDrawOpen(Boolean(liveDrawQuery.data.studentTrackDrawOpen));
    if (liveDrawQuery.data.studentTrackDrawOpen) {
      setPhase("student_live");
      setWantStudentSelfDraw(true);
    }
  }, [liveDrawQuery.data, drawOpen]);

  useEffect(() => {
    if (open) {
      setDrawOpen(studentTrackDrawOpen);
      if (studentTrackDrawOpen) {
        setWantStudentSelfDraw(true);
        setPhase("student_live");
      }
    }
  }, [open, studentTrackDrawOpen]);

  const previewItems: LotteryPreviewItem[] = useMemo(
    () =>
      eligibleTeams.map((team) => ({
        key: `t-${team.id}`,
        sourceLabel: team.name,
      })),
    [eligibleTeams],
  );

  const boardItems = useMemo(() => toBoardItems(assignments), [assignments]);

  useEffect(() => {
    if (!open) {
      setPhase("ready");
      setAssignments([]);
      setSkippedAlreadyAssigned(0);
      setPlacedCount(0);
      setDrawOpen(false);
      setWantStudentSelfDraw(false);
      setLastError(null);
    }
  }, [open]);

  const lotteryMutation = useMutation({
    mutationFn: (studentSelfDraw: boolean) =>
      revealEventTracks(eventId, { roundId, studentSelfDraw }),
    onSuccess: (data, studentSelfDraw) => {
      setLastError(null);
      if (data.mode === "student_draw_open" || studentSelfDraw) {
        setDrawOpen(true);
        setWantStudentSelfDraw(true);
        setPhase("student_live");
        enqueueSnackbar(
          "Track draw opened — team leaders can click Sort on workspace.",
          { variant: "success" },
        );
        return;
      }
      runBulkSuccess(data);
    },
    onError: (error) => {
      const msg = getApiMessage(error, "Team draw failed");
      setLastError(msg);
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const closeDrawMutation = useMutation({
    mutationFn: () => closeStudentTrackDraw(eventId),
    onSuccess: (data) => {
      setDrawOpen(false);
      setWantStudentSelfDraw(false);
      setAssignments(data.assignments ?? []);
      setPhase("done");
      enqueueSnackbar("Locked team draw.", { variant: "info" });
    },
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "Lock draw failed"), {
        variant: "error",
      });
    },
  });

  function runBulkSuccess(data: {
    assignedCount: number;
    skippedAlreadyAssigned: number;
    assignments: TeamLotteryAssignment[];
  }) {
    setSkippedAlreadyAssigned(data.skippedAlreadyAssigned);
    if (data.assignedCount === 0) {
      enqueueSnackbar("No teams need to be assigned to a track.", { variant: "info" });
      setPhase("done");
      return;
    }
    setAssignments(data.assignments);
    setPlacedCount(0);
    setPhase("spinning");
    setTimeout(() => setPhase("reveal"), 1400);
  }

  useEffect(() => {
    if (phase !== "reveal" || boardItems.length === 0) return;
    if (placedCount >= boardItems.length) {
      const t = setTimeout(() => setPhase("done"), 700);
      return () => clearTimeout(t);
    }
    const delay = placedCount === 0 ? 450 : 550;
    const t = setTimeout(() => setPlacedCount((n) => n + 1), delay);
    return () => clearTimeout(t);
  }, [phase, placedCount, boardItems.length]);

  const handleClose = () => {
    onOpenChange(false);
    if (phase === "done") onComplete();
  };

  const pendingCount =
    liveDrawQuery.data?.skippedAlreadyAssigned ??
    previewItems.length - boardItems.length;
  const canRun = trackCount > 0 && previewItems.length > 0;
  const boardPhase =
    phase === "done"
      ? "done"
      : phase === "spinning"
        ? "spinning"
        : phase === "student_live"
          ? boardItems.length > 0
            ? "reveal"
            : "ready"
          : phase;
  const showEmptyDone = phase === "done" && boardItems.length === 0 && !drawOpen;
  const isStudentLive = drawOpen && wantStudentSelfDraw;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-500" />
            {isStudentLive
              ? "Team Draw — Student self-draw"
              : "Team Draw → Track"}
          </DialogTitle>
          <DialogDescription>
            {isStudentLive
              ? `${roundName} · Each team leader clicks Sort on workspace. Live board below.`
              : `${roundName} · ${trackCount} tracks — teams fly to each track (projector view).`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto py-2">
          {phase === "ready" && !drawOpen ? (
            <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border"
                checked={wantStudentSelfDraw}
                onChange={(e) => setWantStudentSelfDraw(e.target.checked)}
              />
              <div>
                <p className="font-medium text-foreground">
                  Student self-draw
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enable: each team leader enters workspace and clicks{" "}
                  <strong>Sort</strong> to randomly draw a track. Disable: Organizers draw
                  all teams at once on projector.
                </p>
              </div>
            </label>
          ) : null}

          {showEmptyDone ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {skippedAlreadyAssigned > 0
                ? `All ${skippedAlreadyAssigned} teams already have a track.`
                : "No teams need assignment."}
            </p>
          ) : (
            <>
              <LotteryBoardAnimation
                mode="team"
                phase={boardPhase}
                items={boardItems}
                placedCount={
                  phase === "student_live" ? boardItems.length : placedCount
                }
                trackSlots={trackSlots}
                previewItems={previewItems}
              />

              {isStudentLive ? (
                <p className="mt-3 text-center text-xs text-emerald-600">
                  Open — {boardItems.length} teams drawn
                  {pendingCount > 0 ? ` · ${pendingCount} teams remaining` : ""}
                </p>
              ) : null}

              {teamsPreviewQuery.isLoading && phase === "ready" ? (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                  Loading teams...
                </p>
              ) : null}

              <AnimatePresence mode="wait">
                {phase === "spinning" && (
                  <motion.p
                    key="spinning-msg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 text-center text-sm font-medium text-muted-foreground"
                  >
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-orange-500" />
                    Shuffling and drawing teams...
                  </motion.p>
                )}
                {phase === "done" && boardItems.length > 0 && (
                  <motion.p
                    key="done-msg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 text-center text-sm font-semibold text-emerald-600"
                  >
                    Completed {boardItems.length} teams!
                  </motion.p>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-row sm:justify-between">
          {phase === "ready" && !showEmptyDone && !wantStudentSelfDraw ? (
            <p className="text-left text-xs text-muted-foreground sm:max-w-md">
              {lastError ? (
                <span className="text-red-500">{lastError}</span>
              ) : (
                <>
                  Only assign for teams <strong>without a track</strong> —{" "}
                  {teamsPreviewQuery.isLoading
                    ? "loading..."
                    : `${previewItems.length} teams ready.`}
                </>
              )}
            </p>
          ) : isStudentLive ? (
            <p className="text-left text-xs text-muted-foreground sm:max-w-md">
              Team leader goes to workspace → <strong>Sort</strong> button.
            </p>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            {phase === "ready" && !showEmptyDone && !drawOpen ? (
              <Button
                type="button"
                size="lg"
                className="gap-2 bg-orange-600 hover:bg-orange-700"
                disabled={
                  lotteryMutation.isPending ||
                  !canRun ||
                  teamsPreviewQuery.isLoading
                }
                onClick={() => lotteryMutation.mutate(wantStudentSelfDraw)}
              >
                {lotteryMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
                {wantStudentSelfDraw
                  ? "Open team draw"
                  : "Draw teams now"}
              </Button>
            ) : null}
            {isStudentLive ? (
              <Button
                type="button"
                variant="outline"
                disabled={closeDrawMutation.isPending}
                onClick={() => closeDrawMutation.mutate()}
              >
                {closeDrawMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Lock draw
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
              {phase === "done" ? "Close & update" : "Cancel"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
