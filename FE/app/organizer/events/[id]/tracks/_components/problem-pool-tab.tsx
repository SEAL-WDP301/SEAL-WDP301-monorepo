"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { Loader2, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { ProblemStatementViewer } from "@/components/problem/problem-statement-viewer";
import { axiosClient } from "@/lib/axios";
import {
  addProblemPoolItem,
  getProblemPool,
  removeProblemPoolItem,
  type OrganizerProblemPoolItem,
} from "@/lib/api/organizer-events.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatTrackCapacityHint } from "@/lib/events/track-capacity";

function getApiMessage(error: unknown, fallback: string) {
  const apiError = error as {
    response?: { data?: { message?: string; errors?: string[] } };
  };
  const errors = apiError.response?.data?.errors;
  if (Array.isArray(errors) && errors.length > 0) return errors.join(", ");
  return apiError.response?.data?.message || fallback;
}

type Props = {
  eventId: string;
  embedded?: boolean;
  maxTeams?: number | null;
  minPoolNeeded?: number;
  unassignedPoolCount?: number;
};

export function TracksProblemPoolTab({
  eventId,
  embedded = false,
  maxTeams,
  minPoolNeeded = 0,
  unassignedPoolCount: unassignedProp,
}: Props) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);

  const poolQuery = useQuery({
    queryKey: ["problemPool", eventId],
    queryFn: () => getProblemPool(eventId),
  });

  const addMutation = useMutation({
    mutationFn: (body: { label: string; problemFileUrl: string }) =>
      addProblemPoolItem(eventId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["problemPool", eventId] });
      queryClient.invalidateQueries({ queryKey: ["organizerEvent", eventId] });
      setLabel("");
      enqueueSnackbar("Added problem to pool", { variant: "success" });
    },
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "Failed to add pool item"), {
        variant: "error",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: number) => removeProblemPoolItem(eventId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["problemPool", eventId] });
      queryClient.invalidateQueries({ queryKey: ["organizerEvent", eventId] });
      enqueueSnackbar("Removed from pool", { variant: "info" });
    },
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "Failed to remove pool item"), {
        variant: "error",
      });
    },
  });

  const handleUpload = async (file: File) => {
    const trimmed = label.trim();
    if (!trimmed) {
      enqueueSnackbar("Enter problem name/topic before uploading", {
        variant: "warning",
      });
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await axiosClient.post("/storage/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const fileUrl = uploadRes.data?.data?.fileUrl;
      if (!fileUrl) throw new Error("Upload failed");
      await addMutation.mutateAsync({ label: trimmed, problemFileUrl: fileUrl });
    } catch (err: unknown) {
      enqueueSnackbar(getApiMessage(err, "Upload failed"), { variant: "error" });
    } finally {
      setUploading(false);
    }
  };

  const items = poolQuery.data ?? [];
  const unassigned =
    unassignedProp ?? items.filter((i) => i.assignedRoundId == null).length;
  const capacityHint = formatTrackCapacityHint(maxTeams, minPoolNeeded);

  return (
    <GlassCard
      className={cn(
        "p-6 shadow-sm",
        embedded
          ? "rounded-none border-0 bg-transparent shadow-none hover:border-transparent"
          : "rounded-[24px] border-border/50",
      )}
    >
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Secret Problem Pool</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload secret problems/topics before Day 1. Use "Random Track" on the
          Tracks &amp; Rounds tab to draw and assign to each track.
          {minPoolNeeded > 0 ? (
            <>
              {" "}
              The largest round needs at least{" "}
              <strong className="text-foreground">{minPoolNeeded}</strong> unassigned
              problems.
            </>
          ) : null}
          {capacityHint ? (
            <>
              {" "}
              <span className="text-orange-600 dark:text-orange-400">
                {capacityHint}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <div className="mb-6 grid gap-4 rounded-2xl border border-dashed border-border p-4 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="pool-label">Name / Topic (hidden from students until draw)</Label>
          <Input
            id="pool-label"
            placeholder="VD: Smart Factory, Smart Campus..."
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div>
          <input
            id="pool-file-input"
            type="file"
            accept=".pdf,.doc,.docx,.md,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            className="gap-2"
            disabled={uploading || addMutation.isPending}
            onClick={() => document.getElementById("pool-file-input")?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload problem to pool
          </Button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="font-medium">{items.length} problems in pool</span>
        <Badge variant="outline">{unassigned} unassigned</Badge>
      </div>

      {poolQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No problems yet. Upload at least as many as the tracks in the round.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: OrganizerProblemPoolItem) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{item.label}</td>
                  <td className="px-4 py-3">
                    <ProblemStatementViewer
                      compact
                      fileUrl={item.problemFileUrl}
                      title={item.label}
                      trackName={item.label}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-orange-500/40 bg-background px-3 text-sm font-semibold text-orange-500 no-underline hover:bg-orange-500/10 hover:text-orange-600"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {item.assignedRoundId != null ? (
                      <Badge variant="success">Track assigned</Badge>
                    ) : (
                      <Badge variant="warning">Unassigned</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={
                        item.assignedRoundId != null ||
                        removeMutation.isPending
                      }
                      onClick={() => removeMutation.mutate(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
