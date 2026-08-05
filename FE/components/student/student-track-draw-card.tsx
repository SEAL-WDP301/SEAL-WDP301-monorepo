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
        enqueueSnackbar(`Đội bạn thuộc bảng: ${data.trackName}`, {
          variant: "success",
        });
        queryClient.invalidateQueries({ queryKey: ["workspace", eventId] });
          onAssigned?.(data.trackName);
        }, 1200);
    },
    onError: (error) => {
      setSpinning(false);
      enqueueSnackbar(getApiMessage(error, "Bốc thăm thất bại"), {
        variant: "error",
      });
    },
  });

  if (resultTrack) {
    return (
      <GlassCard className="rounded-[24px] border-emerald-500/40 bg-emerald-500/10 p-6">
        <p className="text-sm text-muted-foreground">Bảng của đội bạn</p>
        <p className="mt-1 text-2xl font-bold text-emerald-600">{resultTrack}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Track giữ nguyên suốt cuộc thi.
        </p>
      </GlassCard>
    );
  }

  if (!studentTrackDrawOpen) {
    return (
      <GlassCard className="rounded-[24px] border-amber-500/30 bg-amber-500/5 p-6">
        <p className="font-semibold text-foreground">Chờ bốc thăm track</p>
        <p className="mt-1 text-sm text-muted-foreground">
          BTC sẽ mở Phase 2 — sau đó leader bấm Sắp xếp tại đây.
        </p>
      </GlassCard>
    );
  }

  if (!isLeader) {
    return (
      <GlassCard className="rounded-[24px] border-border bg-muted/20 p-6">
        <p className="font-semibold text-foreground">Bốc thăm track</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Chỉ <strong>team leader</strong> được bấm Sắp xếp. Hãy nhờ leader
          bốc thăm trên thiết bị này.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="rounded-[24px] border-orange-500/40 bg-orange-500/5 p-6">
      <p className="font-semibold text-foreground">Bốc thăm bảng (Phase 2)</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Đại diện đội bấm Sắp xếp — hệ thống random vào một bảng còn slot.
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
        Sắp xếp
      </Button>
      {spinning ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-xs text-orange-600"
        >
          Đang xếp vào bảng...
        </motion.p>
      ) : null}
    </GlassCard>
  );
}
