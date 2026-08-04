"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { enqueueSnackbar } from "notistack";
import {
  ChevronDown,
  Edit2,
  Loader2,
  Plus,
  Save,
  Trash2,
  ExternalLink,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { axiosClient } from "@/lib/axios";
import {
  getOrganizerEvent,
  updateOrganizerEvent,
  updateRoundProblemFile,
  removeTrackFromRound,
  type OrganizerEvent,
  type OrganizerEventPayload,
  type OrganizerRound,
  type OrganizerRoundInput,
  type OrganizerTrack,
  type OrganizerTrackInput,
  type SubmissionType,
} from "@/lib/api/organizer-events.api";

type RoundDraft = {
  id?: number;
  roundNumber: number | string;
  name: string;
  trackId: string;
  submissionType: SubmissionType;
  submissionDeadline: string;
  maxFileSizeMb: number | string;
  isTrackSpecific: boolean;
};

type TrackDraft = {
  id?: number;
  name: string;
  description: string;
};

const emptyRound = (roundNumber: number): RoundDraft => ({
  roundNumber,
  name: "",
  trackId: "",
  submissionType: "file",
  submissionDeadline: "",
  maxFileSizeMb: 20,
  isTrackSpecific: false,
});

const emptyTrack = (): TrackDraft => ({
  name: "",
  description: "",
});

function getApiMessage(error: unknown, fallback: string) {
  const apiError = error as {
    response?: { data?: { message?: string; errors?: string[] } };
  };
  const errors = apiError.response?.data?.errors;
  if (Array.isArray(errors) && errors.length > 0) return errors.join(", ");
  return apiError.response?.data?.message || fallback;
}

function toDateTimeInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}

function mapRound(round: OrganizerRound): OrganizerRoundInput {
  return {
    id: round.id,
    roundNumber: round.roundNumber,
    name: round.name,
    submissionType: round.submissionType,
    submissionDeadline: round.submissionDeadline || undefined,
    maxFileSizeMb: round.maxFileSizeMb,
    isTrackSpecific: round.isTrackSpecific,
    trackId: round.trackId ?? null,
  };
}

function mapTrack(track: OrganizerTrack): OrganizerTrackInput {
  return {
    id: track.id,
    name: track.name,
    description: track.description || undefined,
  };
}

/** Client-side guard before opening a round (mirrors BE assertRoundProblemsReady). */
function getOpenRoundBlockReason(
  event: OrganizerEvent,
  round: OrganizerRound,
  tracks: OrganizerTrack[],
): string | null {
  if (!tracks.length) {
    return `Cannot open "${round.name}" - create at least one track first.`;
  }

  const requirePerTrack =
    Boolean(event.deferredTrackAssignment) || round.isTrackSpecific;

  if (requirePerTrack) {
    const missing = tracks.filter(
      (track) =>
        !round.trackProblems?.some(
          (p) => p.trackId === track.id && !!p.problemFileUrl?.trim(),
        ),
    );
    if (missing.length) {
      return `Cannot open "${round.name}" - each track needs a problem file. Missing: ${missing
        .map((t) => t.name)
        .join(", ")}.`;
    }
    return null;
  }

  if (!round.problemFileUrl?.trim()) {
    return `Cannot open "${round.name}" - upload the round problem file first.`;
  }
  return null;
}

function buildEventPayload(
  event: OrganizerEvent,
  tracks: OrganizerTrackInput[],
  rounds: OrganizerRoundInput[],
): OrganizerEventPayload {
  return {
    name: event.name,
    description: event.description || undefined,
    season: event.season,
    year: event.year,
    maxTeams: event.maxTeams,
    minMembersPerTeam: event.minMembersPerTeam,
    maxMembersPerTeam: event.maxMembersPerTeam,
    status: event.status,
    registrationDeadline: event.registrationDeadline || undefined,
    startDate: event.startDate || undefined,
    endDate: event.endDate || undefined,
    githubOrgUrl: event.githubOrgUrl || undefined,
    // Preserve mode — never flip Flow B → A when saving structure here.
    deferredTrackAssignment: Boolean(event.deferredTrackAssignment),
    prizes: event.prizes?.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      quantity: p.quantity,
      amount: p.amount,
      placement: p.placement,
      currency: p.currency,
    })),
    tracks,
    rounds,
  };
}

export default function EventRoundsPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const queryClient = useQueryClient();

  const [isRoundDialogOpen, setIsRoundDialogOpen] = useState(false);
  const [isTrackDialogOpen, setIsTrackDialogOpen] = useState(false);
  const [roundDraft, setRoundDraft] = useState<RoundDraft>(emptyRound(1));
  const [trackDraft, setTrackDraft] = useState<TrackDraft>(emptyTrack);
  // Which round triggered "Add Track" (if any) — a brand-new track created
  // from inside a round's section is scoped to ONLY that round, not every
  // track-specific round in the event.
  const [createTrackRoundId, setCreateTrackRoundId] = useState<number | null>(
    null,
  );
  const [expandedRoundIds, setExpandedRoundIds] = useState<number[]>([]);
  const [didInitExpanded, setDidInitExpanded] = useState(false);

  const toggleRoundExpanded = (roundId: number) => {
    setExpandedRoundIds((current) =>
      current.includes(roundId)
        ? current.filter((id) => id !== roundId)
        : [...current, roundId],
    );
  };

  const eventQuery = useQuery({
    queryKey: ["organizerEvent", eventId],
    queryFn: () => getOrganizerEvent(eventId),
  });

  const event = eventQuery.data;
  const rounds = useMemo(
    () =>
      [...(event?.rounds || [])].sort((a, b) => a.roundNumber - b.roundNumber),
    [event?.rounds],
  );
  const tracks = useMemo(() => event?.tracks || [], [event?.tracks]);

  useEffect(() => {
    if (!event || didInitExpanded) return;
    setExpandedRoundIds((event.rounds || []).map((r) => r.id));
    setDidInitExpanded(true);
  }, [didInitExpanded, event]);

  // Allow tracks/rounds/problem setup until any round leaves not_started.
  // Needed for Flow B recovery after registration deadline when Round 1
  // could not auto-open (missing tracks/files) — event may already be ongoing.
  const canModifyStructure = (event?.rounds || []).every(
    (round) => (round.status || "not_started") === "not_started",
  );

  const saveStructureMutation = useMutation({
    mutationFn: ({
      nextTracks,
      nextRounds,
    }: {
      nextTracks: OrganizerTrackInput[];
      nextRounds: OrganizerRoundInput[];
    }) => {
      if (!event) throw new Error("Event is not loaded.");
      if (!canModifyStructure) {
        throw new Error(
          "Rounds and tracks can only be changed before a round is opened.",
        );
      }
      return updateOrganizerEvent(
        eventId,
        buildEventPayload(event, nextTracks, nextRounds),
      );
    },
    onSuccess: (updatedEvent) => {
      queryClient.setQueryData(["organizerEvent", eventId], updatedEvent);
      queryClient.invalidateQueries({ queryKey: ["organizerEvent", eventId] });
    },
    onError: (error) => {
      enqueueSnackbar(
        getApiMessage(error, "Failed to update event structure"),
        {
          variant: "error",
        },
      );
    },
  });

  const updateRoundStatusMutation = useMutation({
    mutationFn: async ({
      roundId,
      status,
    }: {
      roundId: number;
      status: string;
    }) => {
      const response = await axiosClient.patch(
        `/organizer/events/${eventId}/rounds/${roundId}/status`,
        { status },
      );
      return response.data;
    },
    onSuccess: (res, variables) => {
      const assignment = res?.data?.trackAssignment;
      if (assignment && variables.status === "open") {
        enqueueSnackbar(
          assignment.assignedCount > 0
            ? `Round opened · random assigned ${assignment.assignedCount} team(s) to tracks`
            : "Round opened · no unassigned teams (tracks already set)",
          { variant: "success" },
        );
      } else {
        enqueueSnackbar("Round status updated", { variant: "success" });
      }
      queryClient.invalidateQueries({ queryKey: ["organizerEvent", eventId] });
      queryClient.invalidateQueries({
        queryKey: ["detailedRankings", eventId, String(variables.roundId)],
      });
      queryClient.invalidateQueries({ queryKey: ["organizerTeams", eventId] });
      queryClient.invalidateQueries({
        queryKey: ["organizerSubmissions", eventId, String(variables.roundId)],
      });
    },
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "Failed to update round status"), {
        variant: "error",
      });
    },
  });

  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const handleProblemFileUpload = async (
    roundId: number,
    file: File,
    trackId?: number,
  ) => {
    const key = trackId != null ? `${roundId}-${trackId}` : String(roundId);
    try {
      setUploadingKey(key);
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await axiosClient.post("/storage/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const fileUrl = uploadRes.data?.data?.fileUrl;
      if (!fileUrl) throw new Error("Upload failed: No file URL returned");

      await updateRoundProblemFile(eventId, roundId, fileUrl, trackId);
      enqueueSnackbar(
        trackId != null
          ? "Track problem file uploaded!"
          : "Problem statement file uploaded successfully!",
        { variant: "success" },
      );
      eventQuery.refetch();
    } catch (err: unknown) {
      enqueueSnackbar(getApiMessage(err, "Failed to upload problem file"), {
        variant: "error",
      });
    } finally {
      setUploadingKey(null);
    }
  };

  const handleRemoveProblemFile = async (
    roundId: number,
    trackId?: number,
  ) => {
    const key = trackId != null ? `${roundId}-${trackId}` : String(roundId);
    try {
      setUploadingKey(key);
      await updateRoundProblemFile(eventId, roundId, null, trackId);
      enqueueSnackbar("Problem statement file removed.", { variant: "info" });
      eventQuery.refetch();
    } catch (err: unknown) {
      enqueueSnackbar(getApiMessage(err, "Failed to remove problem file"), {
        variant: "error",
      });
    } finally {
      setUploadingKey(null);
    }
  };

  const openCreateRound = () => {
    const nextRoundNumber =
      rounds.length === 0
        ? 1
        : Math.max(...rounds.map((round) => round.roundNumber)) + 1;
    const draft = emptyRound(nextRoundNumber);
    // Flow B: rounds always need per-track problem files.
    if (event?.deferredTrackAssignment) {
      draft.isTrackSpecific = true;
    }
    setRoundDraft(draft);
    setIsRoundDialogOpen(true);
  };

  const openEditRound = (round: OrganizerRound) => {
    setRoundDraft({
      id: round.id,
      roundNumber: round.roundNumber,
      name: round.name,
      trackId: round.trackId ? String(round.trackId) : "",
      submissionType: round.submissionType,
      submissionDeadline: toDateTimeInput(round.submissionDeadline),
      maxFileSizeMb: round.maxFileSizeMb ?? 20,
      isTrackSpecific: round.isTrackSpecific,
    });
    setIsRoundDialogOpen(true);
  };

  const saveRound = () => {
    if (!event) return;

    const roundNumber = Number(roundDraft.roundNumber);
    const maxFileSizeMb = Number(roundDraft.maxFileSizeMb);
    const normalizedName = roundDraft.name.trim();

    if (!normalizedName) {
      enqueueSnackbar("Round name is required.", { variant: "warning" });
      return;
    }
    if (!Number.isInteger(roundNumber) || roundNumber < 1) {
      enqueueSnackbar("Round number must be a positive integer.", {
        variant: "warning",
      });
      return;
    }
    if (!Number.isFinite(maxFileSizeMb) || maxFileSizeMb < 1) {
      enqueueSnackbar("Max file size must be at least 1 MB.", {
        variant: "warning",
      });
      return;
    }

    if (
      rounds.some(
        (round) =>
          round.id !== roundDraft.id &&
          (round.roundNumber === roundNumber ||
            round.name.trim().toLowerCase() === normalizedName.toLowerCase()),
      )
    ) {
      enqueueSnackbar("Round number and name must be unique.", {
        variant: "warning",
      });
      return;
    }

    const savedRound: OrganizerRoundInput = {
      id: roundDraft.id,
      roundNumber,
      name: normalizedName,
      submissionType: roundDraft.submissionType,
      submissionDeadline: roundDraft.submissionDeadline
        ? new Date(roundDraft.submissionDeadline).toISOString()
        : undefined,
      maxFileSizeMb,
      isTrackSpecific: event.deferredTrackAssignment
        ? true
        : roundDraft.isTrackSpecific,
    };

    const nextRounds = roundDraft.id
      ? rounds.map((round) =>
          round.id === roundDraft.id ? savedRound : mapRound(round),
        )
      : [...rounds.map(mapRound), savedRound];

    saveStructureMutation.mutate(
      {
        nextTracks: tracks.map(mapTrack),
        nextRounds,
      },
      {
        onSuccess: () => {
          enqueueSnackbar(roundDraft.id ? "Round updated" : "Round created", {
            variant: "success",
          });
          setIsRoundDialogOpen(false);
        },
      },
    );
  };

  const deleteRound = (round: OrganizerRound) => {
    const submissionCount = round._count?.submissions ?? 0;
    if (submissionCount > 0) {
      enqueueSnackbar(
        "This round cannot be deleted because it has submissions.",
        {
          variant: "error",
        },
      );
      return;
    }
    if (!window.confirm(`Delete round "${round.name}"?`)) return;

    saveStructureMutation.mutate(
      {
        nextTracks: tracks.map(mapTrack),
        nextRounds: rounds.filter((item) => item.id !== round.id).map(mapRound),
      },
      {
        onSuccess: () =>
          enqueueSnackbar("Round deleted", { variant: "success" }),
      },
    );
  };

  const openCreateTrack = (roundId?: number) => {
    setCreateTrackRoundId(roundId ?? null);
    setTrackDraft(emptyTrack());
    setIsTrackDialogOpen(true);
  };

  const openEditTrack = (track: OrganizerTrack) => {
    setCreateTrackRoundId(null);
    setTrackDraft({
      id: track.id,
      name: track.name,
      description: track.description || "",
    });
    setIsTrackDialogOpen(true);
  };

  const saveTrack = () => {
    if (!event) return;

    const normalizedName = trackDraft.name.trim();

    if (!normalizedName) {
      enqueueSnackbar("Track name is required.", { variant: "warning" });
      return;
    }
    if (
      tracks.some(
        (track) =>
          track.id !== trackDraft.id &&
          track.name.trim().toLowerCase() === normalizedName.toLowerCase(),
      )
    ) {
      enqueueSnackbar("Track name must be unique.", { variant: "warning" });
      return;
    }

    const savedTrack: OrganizerTrackInput = {
      id: trackDraft.id,
      name: normalizedName,
      description: trackDraft.description.trim() || undefined,
    };

    const nextTracks = trackDraft.id
      ? tracks.map((track) =>
          track.id === trackDraft.id ? savedTrack : mapTrack(track),
        )
      : [...tracks.map(mapTrack), savedTrack];

    const isNewTrack = !trackDraft.id;
    const roundToScopeInto = createTrackRoundId;

    saveStructureMutation.mutate(
      {
        nextTracks,
        nextRounds: rounds.map(mapRound),
      },
      {
        onSuccess: async (updatedEvent) => {
          enqueueSnackbar(trackDraft.id ? "Track updated" : "Track created", {
            variant: "success",
          });
          setIsTrackDialogOpen(false);
          setCreateTrackRoundId(null);

          // Scope a brand-new track to ONLY the round it was created from —
          // otherwise it would silently become required in every other
          // track-specific round too (tracks are an event-wide catalog).
          if (isNewTrack && roundToScopeInto) {
            const created = updatedEvent?.tracks?.find(
              (t) => t.name.trim().toLowerCase() === normalizedName.toLowerCase(),
            );
            if (created) {
              try {
                await updateRoundProblemFile(
                  eventId,
                  roundToScopeInto,
                  null,
                  created.id,
                );
                eventQuery.refetch();
              } catch (err: unknown) {
                enqueueSnackbar(
                  getApiMessage(
                    err,
                    "Track created, but failed to add it to this round.",
                  ),
                  { variant: "error" },
                );
              }
            }
          }
        },
      },
    );
  };

  const addExistingTrackToRound = async (roundId: number, trackId: number) => {
    const key = `add-${roundId}-${trackId}`;
    try {
      setUploadingKey(key);
      await updateRoundProblemFile(eventId, roundId, null, trackId);
      enqueueSnackbar("Track added to round.", { variant: "success" });
      eventQuery.refetch();
    } catch (err: unknown) {
      enqueueSnackbar(getApiMessage(err, "Failed to add track to round"), {
        variant: "error",
      });
    } finally {
      setUploadingKey(null);
    }
  };

  const removeTrackFromRoundHandler = async (
    round: OrganizerRound,
    track: OrganizerTrack,
  ) => {
    const hasFile = round.trackProblems?.some(
      (p) => p.trackId === track.id && !!p.problemFileUrl?.trim(),
    );
    const confirmMessage = hasFile
      ? `Remove "${track.name}" from Round ${round.roundNumber}? This also removes the uploaded problem file for this track in this round (the track itself stays in the event).`
      : `Remove "${track.name}" from Round ${round.roundNumber}? The track stays in the event catalog and in any other round it's part of.`;
    if (!window.confirm(confirmMessage)) return;

    const key = `remove-${round.id}-${track.id}`;
    try {
      setUploadingKey(key);
      await removeTrackFromRound(eventId, round.id, track.id);
      enqueueSnackbar("Track removed from round.", { variant: "info" });
      eventQuery.refetch();
    } catch (err: unknown) {
      enqueueSnackbar(getApiMessage(err, "Failed to remove track from round"), {
        variant: "error",
      });
    } finally {
      setUploadingKey(null);
    }
  };

  const deleteTrack = (track: OrganizerTrack) => {
    const teamCount = track._count?.teams ?? 0;
    const usedByRound = rounds.some((round) =>
      round.trackProblems?.some((p) => p.trackId === track.id),
    );

    if (teamCount > 0) {
      enqueueSnackbar("This track cannot be deleted because it has teams.", {
        variant: "error",
      });
      return;
    }
    if (usedByRound) {
      enqueueSnackbar("Remove this track from its rounds before deleting it.", {
        variant: "error",
      });
      return;
    }
    if (!window.confirm(`Delete track "${track.name}"?`)) return;

    saveStructureMutation.mutate(
      {
        nextTracks: tracks.filter((item) => item.id !== track.id).map(mapTrack),
        nextRounds: rounds.map(mapRound),
      },
      {
        onSuccess: () =>
          enqueueSnackbar("Track deleted", { variant: "success" }),
      },
    );
  };

  if (eventQuery.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (eventQuery.isError || !event) {
    return (
      <div className="mx-auto mt-20 max-w-lg rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-500">
        Failed to load event details.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex gap-2">
            <Badge variant="outline">
              {event.season} {event.year}
            </Badge>
            <Badge
              variant={event.status === "draft" ? "warning" : "success"}
              className="capitalize"
            >
              {event.status}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Tracks & Rounds</h1>
          <p className="mt-1 text-muted-foreground">
            Create and maintain the competition structure for {event.name}.
          </p>
        </div>
      </div>

﻿      {/* Event Rounds: horizontal rows + expand tree */}
      <GlassCard className="rounded-[24px] border-border/50 p-6 shadow-sm">
        <SectionHeader
          title="Event Rounds"
          description={`${rounds.length} configured round${rounds.length === 1 ? "" : "s"} · expand a round to add tracks & upload problem files before opening`}
          action={
            <div
              title={
                !canModifyStructure
                  ? "Tracks and rounds are read-only after a round has been opened."
                  : undefined
              }
            >
              <Button
                type="button"
                size="sm"
                className="gap-2 bg-blue-600 hover:bg-blue-700"
                disabled={
                  !canModifyStructure || saveStructureMutation.isPending
                }
                onClick={openCreateRound}
              >
                <Plus className="h-4 w-4" />
                Add Round
              </Button>
            </div>
          }
        />

        {rounds.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-4" />
                  <th className="px-4 py-4 font-semibold">Round</th>
                  <th className="px-4 py-4 font-semibold">Scope</th>
                  <th className="px-4 py-4 font-semibold">Deadline</th>
                  <th className="px-4 py-4 font-semibold">Submission</th>
                  <th className="px-4 py-4 font-semibold">Problem files</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((round) => {
                  const isRoundNotStarted =
                    (round.status || "not_started") === "not_started";
                  const expanded = expandedRoundIds.includes(round.id);
                  // Flow B (deferred) and track-specific rounds need one file per track.
                  const requirePerTrackProblems =
                    Boolean(event.deferredTrackAssignment) ||
                    round.isTrackSpecific;
                  // Track-specific rounds scope their own subset — catalog
                  // tracks are never auto-synced into every round.
                  const isRoundScopedTracks = round.isTrackSpecific;
                  const roundTracks = isRoundScopedTracks
                    ? tracks.filter((track) =>
                        round.trackProblems?.some(
                          (p) => p.trackId === track.id,
                        ),
                      )
                    : tracks;
                  const sortedTracks = [...roundTracks].sort((a, b) =>
                    a.name.localeCompare(b.name),
                  );
                  const addableTracks = isRoundScopedTracks
                    ? [...tracks]
                        .filter(
                          (track) =>
                            !round.trackProblems?.some(
                              (p) => p.trackId === track.id,
                            ),
                        )
                        .sort((a, b) => a.name.localeCompare(b.name))
                    : [];
                  const uploadedCount = requirePerTrackProblems
                    ? sortedTracks.filter((track) =>
                        round.trackProblems?.some(
                          (p) =>
                            p.trackId === track.id && !!p.problemFileUrl?.trim(),
                        ),
                      ).length
                    : round.problemFileUrl?.trim()
                      ? 1
                      : 0;
                  const totalFiles = requirePerTrackProblems
                    ? Math.max(sortedTracks.length, 1)
                    : 1;

                  return (
                    <Fragment key={round.id}>
                      <tr className="border-t border-border hover:bg-white/[0.02]">
                        <td className="px-2 py-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8"
                            aria-label={
                              expanded ? "Collapse tracks" : "Expand tracks"
                            }
                            onClick={() => toggleRoundExpanded(round.id)}
                          >
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform",
                                expanded && "rotate-180",
                              )}
                            />
                          </Button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="text-left"
                            onClick={() =>
                              router.push(
                                `/organizer/events/${eventId}/rounds/${round.id}/teams`,
                              )
                            }
                          >
                            <div className="font-semibold">{round.name}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Round {round.roundNumber}
                            </div>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {round.isTrackSpecific ? (
                            <Badge variant="default">
                              Track specific
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              All tracks combined
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {round.submissionDeadline
                            ? new Date(
                                round.submissionDeadline,
                              ).toLocaleString()
                            : "Not configured"}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="font-medium capitalize">
                            {round.submissionType.replace("_", " ")}
                          </div>
                          <div className="mt-0.5 text-muted-foreground">
                            Max {round.maxFileSizeMb ?? 20} MB
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <button
                            type="button"
                            className="font-medium text-orange-400 hover:underline"
                            onClick={() => toggleRoundExpanded(round.id)}
                          >
                            {uploadedCount}/{totalFiles} uploaded
                            {!expanded ? " · Expand list" : ""}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={round.status || "not_started"}
                            disabled={updateRoundStatusMutation.isPending}
                            onChange={(selectEvent) => {
                              const nextStatus = selectEvent.target.value;
                              if (nextStatus === "open") {
                                const block = getOpenRoundBlockReason(
                                  event,
                                  round,
                                  sortedTracks,
                                );
                                if (block) {
                                  enqueueSnackbar(block, { variant: "warning" });
                                  selectEvent.target.value =
                                    round.status || "not_started";
                                  return;
                                }
                              }
                              updateRoundStatusMutation.mutate({
                                roundId: round.id,
                                status: nextStatus,
                              });
                            }}
                            className="h-9 rounded-lg border border-input bg-background px-3 text-sm capitalize"
                          >
                            <option value="not_started">Not Started</option>
                            <option value="open">Open</option>
                            <option value="closed">Closed</option>
                            <option value="results_published">
                              Results Published
                            </option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="flex justify-end gap-2"
                            title={
                              !canModifyStructure
                                ? "Tracks and rounds are read-only after a round has been opened."
                                : undefined
                            }
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              title="Edit round"
                              disabled={
                                !canModifyStructure ||
                                saveStructureMutation.isPending
                              }
                              onClick={() => openEditRound(round)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="Delete round"
                              disabled={
                                !canModifyStructure ||
                                saveStructureMutation.isPending
                              }
                              onClick={() => deleteRound(round)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {expanded && (
                        <tr className="border-t border-border bg-muted/15">
                          <td colSpan={8} className="px-4 py-4 sm:px-6">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold">
                                  Tracks under Round {round.roundNumber}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {requirePerTrackProblems
                                    ? "Add tracks to this round only, then upload a problem file for each. Event catalog tracks are not auto-synced across rounds."
                                    : "Before opening this round: upload one shared problem file for all teams."}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {isRoundScopedTracks &&
                                addableTracks.length > 0 ? (
                                  <select
                                    className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                                    disabled={
                                      !canModifyStructure ||
                                      saveStructureMutation.isPending
                                    }
                                    value=""
                                    onChange={(e) => {
                                      const trackId = Number(e.target.value);
                                      if (trackId) {
                                        addExistingTrackToRound(
                                          round.id,
                                          trackId,
                                        );
                                      }
                                      e.target.value = "";
                                    }}
                                    title="Add a track already in the event catalog to this round"
                                  >
                                    <option value="" disabled>
                                      + Add existing track…
                                    </option>
                                    {addableTracks.map((track) => (
                                      <option key={track.id} value={track.id}>
                                        {track.name}
                                      </option>
                                    ))}
                                  </select>
                                ) : null}
                                <Button
                                  type="button"
                                  size="sm"
                                  className="gap-2 bg-orange-600 hover:bg-orange-700"
                                  disabled={
                                    !canModifyStructure ||
                                    saveStructureMutation.isPending
                                  }
                                  onClick={() =>
                                    openCreateTrack(
                                      requirePerTrackProblems
                                        ? round.id
                                        : undefined,
                                    )
                                  }
                                >
                                  <Plus className="h-4 w-4" />
                                  Add Track
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-2 rounded-xl border border-border bg-background/60 p-2">
                              {requirePerTrackProblems ? (
                                sortedTracks.length > 0 ? (
                                  sortedTracks.map((track) => {
                                    const problem = round.trackProblems?.find(
                                      (p) => p.trackId === track.id,
                                    );
                                    const key = `${round.id}-${track.id}`;
                                    return (
                                      <ProblemTrackRow
                                        key={track.id}
                                        name={track.name}
                                        fileUrl={problem?.problemFileUrl}
                                        canUpload={isRoundNotStarted}
                                        busy={uploadingKey === key}
                                        canEditTrack={canModifyStructure}
                                        onEditTrack={() => openEditTrack(track)}
                                        onRemoveFromRound={
                                          isRoundScopedTracks &&
                                          canModifyStructure
                                            ? () =>
                                                removeTrackFromRoundHandler(
                                                  round,
                                                  track,
                                                )
                                            : undefined
                                        }
                                        onUpload={(file) =>
                                          handleProblemFileUpload(
                                            round.id,
                                            file,
                                            track.id,
                                          )
                                        }
                                        onRemove={() =>
                                          handleRemoveProblemFile(
                                            round.id,
                                            track.id,
                                          )
                                        }
                                      />
                                    );
                                  })
                                ) : (
                                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                                    No tracks yet. Click{" "}
                                    <strong>Add Track</strong> to create one
                                    before opening the round.
                                  </p>
                                )
                              ) : (
                                <ProblemTrackRow
                                  name="All tracks (shared)"
                                  fileUrl={round.problemFileUrl}
                                  canUpload={isRoundNotStarted}
                                  busy={uploadingKey === String(round.id)}
                                  onUpload={(file) =>
                                    handleProblemFileUpload(round.id, file)
                                  }
                                  onRemove={() =>
                                    handleRemoveProblemFile(round.id)
                                  }
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="No rounds configured. Add the first round to define a submission stage." />
        )}
      </GlassCard>

      {/* Event Tracks catalog */}
      <GlassCard className="rounded-[24px] border-border/50 p-6 shadow-sm">
        <SectionHeader
          title="Event Tracks"
          description={`${tracks.length} track${tracks.length === 1 ? "" : "s"} in catalog — add to each round separately; not auto-synced`}
          action={
            <div
              title={
                !canModifyStructure
                  ? "Tracks and rounds are read-only after a round has been opened."
                  : undefined
              }
            >
              <Button
                type="button"
                size="sm"
                className="gap-2 bg-orange-600 hover:bg-orange-700"
                disabled={
                  !canModifyStructure || saveStructureMutation.isPending
                }
                onClick={openCreateTrack}
              >
                <Plus className="h-4 w-4" />
                Add Track
              </Button>
            </div>
          }
        />

        {tracks.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[...tracks]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((track) => (
                <div
                  key={track.id}
                  className="flex min-h-40 flex-col rounded-2xl border border-border bg-background/60 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold">
                        {track.name}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                        {track.description || "No description provided."}
                      </p>
                    </div>
                    <div
                      className="flex shrink-0 gap-1"
                      title={
                        !canModifyStructure
                          ? "Tracks and rounds are read-only after a round has been opened."
                          : undefined
                      }
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        title="Edit track"
                        disabled={
                          !canModifyStructure ||
                          saveStructureMutation.isPending
                        }
                        onClick={() => openEditTrack(track)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Delete track"
                        disabled={
                          !canModifyStructure ||
                          saveStructureMutation.isPending
                        }
                        onClick={() => deleteTrack(track)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-3 pt-5 text-center">
                    <TrackStat
                      label="Teams"
                      value={track._count?.teams ?? 0}
                    />
                    <TrackStat
                      label="Team size"
                      value={`${event.minMembersPerTeam}-${event.maxMembersPerTeam}`}
                    />
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <EmptyState text="No tracks configured. Add a track before creating track-specific rounds." />
        )}
      </GlassCard>

      <RoundDialog
        open={isRoundDialogOpen}
        onOpenChange={setIsRoundDialogOpen}
        draft={roundDraft}
        setDraft={setRoundDraft}
        isSaving={saveStructureMutation.isPending}
        onSave={saveRound}
        deferredTrackAssignment={Boolean(event.deferredTrackAssignment)}
      />

      <TrackDialog
        open={isTrackDialogOpen}
        onOpenChange={setIsTrackDialogOpen}
        draft={trackDraft}
        setDraft={setTrackDraft}
        isSaving={saveStructureMutation.isPending}
        onSave={saveTrack}
      />
    </div>
  );
}

function RoundDialog({
  open,
  onOpenChange,
  draft,
  setDraft,
  isSaving,
  onSave,
  deferredTrackAssignment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: RoundDraft;
  setDraft: React.Dispatch<React.SetStateAction<RoundDraft>>;
  isSaving: boolean;
  onSave: () => void;
  deferredTrackAssignment: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit Round" : "Add Round"}</DialogTitle>
          <DialogDescription>
            Configure the round scope, submission type, and deadline.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 py-2 md:grid-cols-2">
          <Field label="Round number *">
            <Input
              type="number"
              min={1}
              value={draft.roundNumber}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  roundNumber: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Round name *">
            <Input
              value={draft.name}
              placeholder="Preliminary Round"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Submission type *">
            <select
              value={draft.submissionType}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  submissionType: event.target.value as SubmissionType,
                }))
              }
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="file">File / PDF</option>
              <option value="github_link">URL submission</option>
            </select>
          </Field>

          <Field label="Submission deadline">
            <Input
              type="datetime-local"
              value={draft.submissionDeadline}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  submissionDeadline: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Max file size (MB) *">
            <Input
              type="number"
              min={1}
              max={500}
              value={draft.maxFileSizeMb}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  maxFileSizeMb: event.target.value,
                }))
              }
            />
          </Field>

          {!deferredTrackAssignment ? (
            <label className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={draft.isTrackSpecific}
                onChange={(changeEvent) =>
                  setDraft((current) => ({
                    ...current,
                    isTrackSpecific: changeEvent.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
              <span>
                <strong>Track-specific round</strong>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Disable this option for a shared final round that applies to
                  all tracks. Opening still requires at least one track and a
                  problem file.
                </span>
              </span>
            </label>
          ) : (
            <p className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground md:col-span-2">
              This event assigns tracks when a round opens - each track must
              have its own problem file before you can open the round.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={isSaving} onClick={onSave}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Round
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TrackDialog({
  open,
  onOpenChange,
  draft,
  setDraft,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: TrackDraft;
  setDraft: React.Dispatch<React.SetStateAction<TrackDraft>>;
  isSaving: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit Track" : "Add Track"}</DialogTitle>
          <DialogDescription>
            Configure the track capacity and team size.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Field label="Track name *">
            <Input
              value={draft.name}
              placeholder="AI & Machine Learning"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={draft.description}
              className="min-h-24 resize-none"
              placeholder="Describe the track focus and eligibility."
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={isSaving} onClick={onSave}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Track
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function ProblemTrackRow({
  name,
  fileUrl,
  canUpload,
  busy,
  canEditTrack,
  onEditTrack,
  onRemoveFromRound,
  onUpload,
  onRemove,
}: {
  name: string;
  fileUrl?: string | null;
  canUpload: boolean;
  busy: boolean;
  canEditTrack?: boolean;
  onEditTrack?: () => void;
  /** Unscope this track from the round (RoundTrackProblem row). Omit for the
   * shared "All tracks" row, which isn't a real per-track scope. */
  onRemoveFromRound?: () => void;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{name}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {canEditTrack && onEditTrack ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={onEditTrack}
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit track
          </Button>
        ) : null}

        {canEditTrack && onRemoveFromRound ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 border-red-500/40 text-red-500 hover:bg-red-500/10"
            title="Remove this track from this round only (keeps it in the event catalog)"
            onClick={onRemoveFromRound}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove from round
          </Button>
        ) : null}

        {fileUrl ? (
          <>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-9 gap-1.5 border-orange-500/40 font-semibold text-orange-400 hover:bg-orange-500/10"
            >
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                View file
              </a>
            </Button>
            {canUpload ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                title="Remove problem file"
                onClick={onRemove}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            ) : (
              <span className="rounded border border-border px-2 py-1 text-[10px] italic text-muted-foreground">
                Locked
              </span>
            )}
          </>
        ) : canUpload ? (
          <label
            className={cn(
              "inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-orange-700",
              busy && "pointer-events-none opacity-70",
            )}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload file
            <input
              type="file"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
          </label>
        ) : (
          <span
            title="Problem file can only be uploaded when round status is Not Started"
            className="text-xs italic text-muted-foreground"
          >
            No file (Locked)
          </span>
        )}
      </div>
    </div>
  );
}

function TrackStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2">
      <div className="text-base font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
