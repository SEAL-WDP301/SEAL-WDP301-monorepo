"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { Loader2, Shuffle } from "lucide-react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { drawMyTeamTrack } from "@/lib/api/workspace.api";

function getApiMessage(error: unknown, fallback: string) {
  const apiError = error as {
    response?: { data?: { message?: string; errors?: string[] } };
  };
  const errors = apiError.response?.data?.errors;
  if (Array.isArray(errors) && errors.length > 0) return errors.join(", ");
  return apiError.response?.data?.message || fallback;
}

type Props = {
  eventId: number;
  canDrawTrack: boolean;
  isLeader: boolean;
  studentTrackDrawOpen: boolean;
  onAssigned?: (trackName: string) => void;
};

export function StudentTrackDrawCard({
  eventId,
  canDrawTrack,
  isLeader,
  studentTrackDrawOpen,
  onAssigned,
}: Props) {
  const queryClient = useQueryClient();
  const [resultTrack, setResultTrack] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const drawMutation = useMutation({
    mutationFn: () => drawMyTeamTrack(eventId),
    onMutate: () => setSpinning(true),
    onSuccess: (data) => {
      setTimeout(() => {
        setSpinning(false);
        setResultTrack(data.trackName);
        enqueueSnackbar(`Your team was assigned to: ${data.trackName}`, {
          variant: "success",
        });
        queryClient.invalidateQueries({ queryKey: ["workspace", eventId] });
          onAssigned?.(data.trackName);
        }, 1200);
    },
    onError: (error) => {
      setSpinning(false);
      enqueueSnackbar(getApiMessage(error, "Track draw failed"), {
        variant: "error",
      });
    },
  });

  if (resultTrack) {
    return (
      <GlassCard
        glow
        className="relative overflow-hidden rounded-[24px] border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-card to-background p-6"
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-orange-500/15 blur-[60px]" />
        <p className="relative z-10 text-sm text-muted-foreground">Your team&apos;s track</p>
        <p className="relative z-10 mt-1 text-2xl font-bold text-orange-600 dark:text-orange-400">
          {resultTrack}
        </p>
        <p className="relative z-10 mt-2 text-xs text-muted-foreground">
          This track remains unchanged throughout the competition.
        </p>
      </GlassCard>
    );
  }

  if (!studentTrackDrawOpen) {
    return (
      <GlassCard className="rounded-[24px] border-amber-500/30 bg-amber-500/5 p-6">
        <p className="font-semibold text-foreground">Waiting for the track draw</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The organizer will open Phase 2, then the team leader can draw a track here.
        </p>
      </GlassCard>
    );
  }

  if (!isLeader) {
    return (
      <GlassCard className="rounded-[24px] border-border bg-muted/20 p-6">
        <p className="font-semibold text-foreground">Track draw</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Only the <strong>team leader</strong> can draw a track. Ask the leader
          to complete the draw on this device.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="rounded-[24px] border-orange-500/40 bg-orange-500/5 p-6">
      <p className="font-semibold text-foreground">Draw a track (Phase 2)</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The team leader starts the draw, and the system randomly assigns an available track.
      </p>
      <Button
        type="button"
        size="lg"
        className="mt-4 gap-2 bg-orange-600 hover:bg-orange-700"
        disabled={!canDrawTrack || drawMutation.isPending || spinning}
        onClick={() => drawMutation.mutate()}
      >
        {spinning || drawMutation.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Shuffle className="h-5 w-5" />
        )}
        Draw track
      </Button>
      {spinning ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-xs text-orange-600"
        >
          Assigning a track...
        </motion.p>
      ) : null}
    </GlassCard>
  );
}
