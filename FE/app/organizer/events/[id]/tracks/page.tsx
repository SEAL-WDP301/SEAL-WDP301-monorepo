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
  Check,
  ChevronDown,
  Edit2,
  GitMerge,
  Layers,
  Loader2,
  Plus,
  Save,
  Shuffle,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  canAddTrackForMaxTeams,
  countEffectiveAssignedProblems,
  countTeamsOnTracks,
  countUnassignedPoolItems,
  getCeremonyRound,
  getEffectiveTrackProblemUrl,
  getProblemLotteryDisableReason,
  getTeamLotteryDisableReason,
  isProblemLotteryDone,
  isTeamLotteryDone,
} from "@/lib/events/track-capacity";
import { ProblemStatementViewer } from "@/components/problem/problem-statement-viewer";
import { TracksProblemPoolTab } from "./_components/problem-pool-tab";
import { ProblemLotteryDialog } from "./_components/problem-lottery-dialog";
import { TeamLotteryDialog } from "./_components/team-lottery-dialog";

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
  createRoundTrack,
  updateTrackMetadata,
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
  advanceCount: number | string;
};

type TrackDraft = {
  id?: number;
  name: string;
  description: string;
};

function isLastRoundDraft(
  draft: RoundDraft,
  allRounds: OrganizerRound[],
): boolean {
  const draftNum = Number(draft.roundNumber);
  if (!Number.isInteger(draftNum) || draftNum < 1) return false;
  const numbers = allRounds
    .filter((r) => r.id !== draft.id)
    .map((r) => r.roundNumber);
  numbers.push(draftNum);
  return draftNum === Math.max(...numbers);
}

const emptyRound = (roundNumber: number): RoundDraft => ({
  roundNumber,
  name: "",
  trackId: "",
  submissionType: "file",
  submissionDeadline: "",
  maxFileSizeMb: 20,
  isTrackSpecific: false,
  advanceCount: "",
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
    advanceCount: round.advanceCount ?? null,
  };
}

function mapTrack(track: OrganizerTrack): OrganizerTrackInput {
  return {
    id: track.id,
    name: track.name,
    description: track.description || undefined,
  };
}

function canModifyRoundTracks(round: OrganizerRound) {
  return (round.status || "not_started") === "not_started";
}

/** Block adding tracks once the event is live or any round has left Not Started. */
function getAddTrackDisableReason(
  event: OrganizerEvent | undefined,
  round: OrganizerRound,
): string | null {
  if (!event) return "Event is not loaded.";
  if (event.status === "closed") return "Closed events cannot add tracks.";
  if (event.status === "ongoing") {
    return "Cannot add tracks while the event is ongoing.";
  }
  const opened = (event.rounds || []).find(
    (r) => (r.status || "not_started") !== "not_started",
  );
  if (opened) {
    return `Cannot add tracks after a round has opened ("${opened.name}").`;
  }
  if (!canModifyRoundTracks(round)) {
    return "Tracks can only be added while this round is Not Started.";
  }
  return null;
}

function LotteryHeaderButton({
  disableReason,
  className,
  children,
  onClick,
  variant,
}: {
  disableReason: string | null;
  className?: string;
  children: ReactNode;
  onClick: () => void;
  variant?: "default" | "outline";
}) {
  const disabled = Boolean(disableReason);
  return (
    <span
      title={disableReason ?? undefined}
      className={cn("inline-flex", disabled && "cursor-not-allowed")}
    >
      <Button
        type="button"
        variant={variant}
        className={className}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </Button>
    </span>
  );
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

  const requirePerTrack = round.isTrackSpecific;

  if (requirePerTrack) {
    const missing = tracks.filter(
      (track) =>
        !round.trackProblems?.some(
          (p) => p.trackId === track.id && !!p.problemFileUrl?.trim(),
        ),
    );
    if (missing.length) {
      return event.deferredTrackAssignment
        ? `Cannot open "${round.name}" - chưa gán đề cho bảng: ${missing
            .map((t) => t.name)
            .join(", ")}. Thêm đề vào Pool đề rồi chạy Bốc thăm Phase 1.`
        : `Cannot open "${round.name}" - each track needs a problem file. Missing: ${missing
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
  const [createTrackRoundId, setCreateTrackRoundId] = useState<number | null>(
    null,
  );
  const [pendingRemove, setPendingRemove] = useState<{
    round: OrganizerRound;
    track: OrganizerTrack;
  } | null>(null);
  const [expandedRoundIds, setExpandedRoundIds] = useState<number[]>([]);
  const [didInitExpanded, setDidInitExpanded] = useState(false);
  const [lotteryRound, setLotteryRound] = useState<{
    id: number;
    name: string;
    trackCount: number;
    trackSlots: { trackId: number; trackName: string }[];
  } | null>(null);
  const [teamLotteryRound, setTeamLotteryRound] = useState<{
    id: number;
    name: string;
    trackCount: number;
    trackSlots: { trackId: number; trackName: string }[];
  } | null>(null);
  const [tracksTab, setTracksTab] = useState("rounds");

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
  const unassignedPoolCount = useMemo(
    () => countUnassignedPoolItems(event?.problemPoolItems),
    [event?.problemPoolItems],
  );
  const ceremonyRound = useMemo(() => getCeremonyRound(rounds), [rounds]);
  const defaultCeremonyRound = useMemo(() => {
    if (!ceremonyRound) return null;
    const trackProblems = ceremonyRound.trackProblems ?? [];
    return {
      id: ceremonyRound.id!,
      name: (rounds.find((r) => r.id === ceremonyRound.id)?.name ??
        "Ceremony round") as string,
      trackCount: trackProblems.length,
      trackProblems,
      trackSlots: trackProblems.map((tp) => ({
        trackId: tp.trackId,
        trackName:
          tracks.find((t) => t.id === tp.trackId)?.name ?? `Bảng ${tp.trackId}`,
      })),
    };
  }, [ceremonyRound, rounds, tracks]);

  const poolPreviewItems = useMemo(
    () =>
      (event?.problemPoolItems ?? [])
        .filter((item) => item.assignedRoundId == null)
        .map((item) => ({ key: `p-${item.id}`, sourceLabel: item.label })),
    [event?.problemPoolItems],
  );

  const phase1DisableReason = useMemo(() => {
    if (!ceremonyRound) {
      return getProblemLotteryDisableReason(0, unassignedPoolCount);
    }
    const assignedProblemCount = countEffectiveAssignedProblems(
      (ceremonyRound.trackProblems ?? []).map((tp) => tp.trackId),
      ceremonyRound,
      rounds,
      Boolean(event?.deferredTrackAssignment),
    );
    return getProblemLotteryDisableReason(
      defaultCeremonyRound?.trackCount ?? 0,
      unassignedPoolCount,
      event?.maxTeams,
      isProblemLotteryDone(
        event?.problemPoolItems,
        ceremonyRound.trackProblems?.length ?? 0,
        assignedProblemCount,
      ),
    );
  }, [
    ceremonyRound,
    defaultCeremonyRound,
    unassignedPoolCount,
    event?.maxTeams,
    event?.problemPoolItems,
    event?.deferredTrackAssignment,
    rounds,
  ]);

  const teamsOnTracks = useMemo(
    () => countTeamsOnTracks(tracks),
    [tracks],
  );

  const phase2DisableReason = useMemo(() => {
    if (!ceremonyRound) {
      return getTeamLotteryDisableReason(0, event?.maxTeams, []);
    }
    const effectiveProblems = (ceremonyRound.trackProblems ?? []).map(
      (tp) => ({
        problemFileUrl: getEffectiveTrackProblemUrl(
          tp.trackId,
          ceremonyRound,
          rounds,
          Boolean(event?.deferredTrackAssignment),
        ),
      }),
    );
    return getTeamLotteryDisableReason(
      ceremonyRound.trackProblems?.length ?? 0,
      event?.maxTeams,
      effectiveProblems,
      isTeamLotteryDone(teamsOnTracks, event?.studentTrackDrawOpen),
    );
  }, [
    ceremonyRound,
    rounds,
    event?.maxTeams,
    event?.deferredTrackAssignment,
    event?.studentTrackDrawOpen,
    teamsOnTracks,
  ]);

  useEffect(() => {
    if (!event || didInitExpanded) return;
    setExpandedRoundIds((event.rounds || []).map((r) => r.id));
    setDidInitExpanded(true);
  }, [didInitExpanded, event]);

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

  const roundTrackMutation = useMutation({
    mutationFn: async (payload: {
      mode: "create" | "update";
      roundId?: number;
      trackId?: number;
      name: string;
      description?: string;
    }) => {
      const description = payload.description?.trim() || undefined;
      if (payload.mode === "create") {
        if (!payload.roundId) throw new Error("Round is required.");
        return createRoundTrack(eventId, payload.roundId, {
          name: payload.name,
          description,
        });
      }
      if (!payload.trackId) throw new Error("Track is required.");
      return updateTrackMetadata(eventId, payload.trackId, {
        name: payload.name,
        description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizerEvent", eventId] });
    },
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "Failed to save track"), {
        variant: "error",
      });
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
            ? `Round opened · assigned ${assignment.assignedCount} team(s) to this round's track(s)`
            : "Round opened · no eligible teams to assign for this round",
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
      advanceCount: round.advanceCount ?? "",
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

    const isLastRound = isLastRoundDraft(roundDraft, rounds);
    const advanceCountRaw = Number(roundDraft.advanceCount);

    if (!isLastRound) {
      if (
        !Number.isInteger(advanceCountRaw) ||
        advanceCountRaw < 1
      ) {
        enqueueSnackbar("Advance count must be at least 1 for non-final rounds.", {
          variant: "warning",
        });
        return;
      }
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
      advanceCount: isLastRound ? null : advanceCountRaw,
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

  const openCreateTrack = (roundId: number) => {
    setCreateTrackRoundId(roundId);
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

    if (trackDraft.id) {
      roundTrackMutation.mutate(
        {
          mode: "update",
          trackId: trackDraft.id,
          name: normalizedName,
          description: trackDraft.description.trim(),
        },
        {
          onSuccess: () => {
            enqueueSnackbar("Track updated", { variant: "success" });
            setIsTrackDialogOpen(false);
          },
        },
      );
      return;
    }

    if (!createTrackRoundId) {
      enqueueSnackbar("Add tracks from inside each round section.", {
        variant: "warning",
      });
      return;
    }

    roundTrackMutation.mutate(
      {
        mode: "create",
        roundId: createTrackRoundId,
        name: normalizedName,
        description: trackDraft.description.trim(),
      },
      {
        onSuccess: () => {
          enqueueSnackbar("Track added to round", { variant: "success" });
          setIsTrackDialogOpen(false);
          setCreateTrackRoundId(null);
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

  const syncTracksFromPreviousRound = async (
    targetRound: OrganizerRound,
    sourceTrackIds: number[],
  ) => {
    const missing = sourceTrackIds.filter(
      (trackId) =>
        !targetRound.trackProblems?.some((p) => p.trackId === trackId),
    );
    if (missing.length === 0) {
      enqueueSnackbar("Tất cả bảng đã có trong vòng này.", { variant: "info" });
      return;
    }
    const key = `sync-${targetRound.id}`;
    try {
      setUploadingKey(key);
      for (const trackId of missing) {
        await updateRoundProblemFile(eventId, targetRound.id, null, trackId);
      }
      enqueueSnackbar(
        `Đã đồng bộ ${missing.length} bảng từ vòng trước.`,
        { variant: "success" },
      );
      eventQuery.refetch();
    } catch (err: unknown) {
      enqueueSnackbar(getApiMessage(err, "Failed to sync tracks from previous round"), {
        variant: "error",
      });
    } finally {
      setUploadingKey(null);
    }
  };

  const confirmRemoveTrackFromRound = async () => {
    if (!pendingRemove) return;
    const { round, track } = pendingRemove;
    const key = `remove-${round.id}-${track.id}`;
    try {
      setUploadingKey(key);
      await removeTrackFromRound(eventId, round.id, track.id);
      enqueueSnackbar("Track removed from round.", { variant: "info" });
      eventQuery.refetch();
      setPendingRemove(null);
    } catch (err: unknown) {
      enqueueSnackbar(getApiMessage(err, "Failed to remove track from round"), {
        variant: "error",
      });
    } finally {
      setUploadingKey(null);
    }
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

  const isDeferred = Boolean(event.deferredTrackAssignment);

  const workspaceTabs = [
    { id: "rounds", label: "Tracks & Rounds", icon: GitMerge },
    { id: "pool", label: "Pool đề", icon: Layers },
  ] as const;

  const panelShellClass = (embedded: boolean) =>
    cn(
      "p-6 shadow-sm",
      embedded
        ? "rounded-none border-0 bg-transparent shadow-none hover:border-transparent"
        : "rounded-[24px] border-border/50",
    );

  const roundsPanel = (embedded = false) => (
    <GlassCard className={panelShellClass(embedded)}>
        <SectionHeader
          title="Event Rounds"
          description={
            isDeferred
              ? `${rounds.length} round${rounds.length === 1 ? "" : "s"}`
              : `${rounds.length} configured round${rounds.length === 1 ? "" : "s"} · expand a round to add tracks & upload problem files before opening`
          }
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
                  const previousRound = rounds.find(
                    (r) => r.roundNumber === round.roundNumber - 1,
                  );
                  const requirePerTrackProblems = round.isTrackSpecific;
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
                  const previousRoundTracks =
                    previousRound && isDeferred
                      ? tracks
                          .filter((track) =>
                            previousRound.trackProblems?.some(
                              (p) => p.trackId === track.id,
                            ),
                          )
                          .sort((a, b) => a.name.localeCompare(b.name))
                      : [];
                  const tracksPendingSync = previousRoundTracks.filter(
                    (track) =>
                      !round.trackProblems?.some((p) => p.trackId === track.id),
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
                    ? countEffectiveAssignedProblems(
                        sortedTracks.map((track) => track.id),
                        round,
                        rounds,
                        isDeferred,
                      )
                    : round.problemFileUrl?.trim()
                      ? 1
                      : 0;
                  const totalFiles = requirePerTrackProblems
                    ? sortedTracks.length > 0
                      ? sortedTracks.length
                      : tracksPendingSync.length
                    : 1;
                  const problemFilesLabel =
                    sortedTracks.length === 0 && tracksPendingSync.length > 0
                      ? `Chưa đồng bộ · ${tracksPendingSync.length} bảng`
                      : totalFiles === 0
                        ? "Chưa có bảng"
                        : `${uploadedCount}/${totalFiles}`;

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
                            <Badge variant="default">Track specific</Badge>
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
                            {problemFilesLabel}
                            {!expanded && sortedTracks.length > 0 ? " · Expand list" : ""}
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
                                {!isDeferred && requirePerTrackProblems ? (
                                  <p className="text-xs text-muted-foreground">
                                    Upload file đề trực tiếp cho từng track (round
                                    chưa mở mới sửa được).
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {isDeferred &&
                                tracksPendingSync.length > 0 &&
                                canModifyRoundTracks(round) ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="gap-2"
                                    disabled={
                                      saveStructureMutation.isPending ||
                                      uploadingKey === `sync-${round.id}`
                                    }
                                    onClick={() =>
                                      syncTracksFromPreviousRound(
                                        round,
                                        previousRoundTracks.map((t) => t.id),
                                      )
                                    }
                                  >
                                    {uploadingKey === `sync-${round.id}` ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <GitMerge className="h-4 w-4" />
                                    )}
                                    Đồng bộ {tracksPendingSync.length} bảng từ R
                                    {previousRound!.roundNumber}
                                  </Button>
                                ) : null}
                                {isRoundScopedTracks &&
                                addableTracks.length > 0 &&
                                canModifyRoundTracks(round) ? (
                                  <select
                                    className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                                    disabled={saveStructureMutation.isPending}
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
                                    title="Reuse a track from another round in this event"
                                  >
                                    <option value="" disabled>
                                      + Reuse track…
                                    </option>
                                    {addableTracks.map((track) => (
                                      <option key={track.id} value={track.id}>
                                        {track.name}
                                      </option>
                                    ))}
                                  </select>
                                ) : null}
                                {requirePerTrackProblems ? (
                                  (() => {
                                    const structureBlock =
                                      getAddTrackDisableReason(event, round);
                                    const maxTeamsBlock =
                                      !canAddTrackForMaxTeams(
                                        event.maxTeams,
                                        sortedTracks.length,
                                      )
                                        ? `Max ${event.maxTeams} đội → tối đa ${event.maxTeams} bảng trong round này.`
                                        : null;
                                    const addTrackReason =
                                      structureBlock || maxTeamsBlock;
                                    return (
                                      <span
                                        title={addTrackReason ?? undefined}
                                        className={cn(
                                          "inline-flex",
                                          addTrackReason && "cursor-not-allowed",
                                        )}
                                      >
                                        <Button
                                          type="button"
                                          size="sm"
                                          className="gap-2 bg-orange-600 hover:bg-orange-700"
                                          disabled={
                                            Boolean(addTrackReason) ||
                                            roundTrackMutation.isPending
                                          }
                                          onClick={() =>
                                            openCreateTrack(round.id)
                                          }
                                        >
                                          <Plus className="h-4 w-4" />
                                          Add Track
                                        </Button>
                                      </span>
                                    );
                                  })()
                                ) : null}
                              </div>
                            </div>

                            <div className="space-y-2 rounded-xl border border-border bg-background/60 p-2">
                              {requirePerTrackProblems ? (
                                sortedTracks.length > 0 ? (
                                  sortedTracks.map((track) => {
                                    const problem = round.trackProblems?.find(
                                      (p) => p.trackId === track.id,
                                    );
                                    const effectiveUrl = isDeferred
                                      ? getEffectiveTrackProblemUrl(
                                          track.id,
                                          round,
                                          rounds,
                                          isDeferred,
                                        )
                                      : problem?.problemFileUrl ?? null;
                                    const key = `${round.id}-${track.id}`;
                                    return (
                                      <ProblemTrackRow
                                        key={track.id}
                                        name={track.name}
                                        fileUrl={effectiveUrl}
                                        canUpload={
                                          isRoundNotStarted &&
                                          !isDeferred &&
                                          requirePerTrackProblems
                                        }
                                        emptyHint={
                                          isDeferred && !effectiveUrl
                                            ? "Chưa có đề"
                                            : isRoundNotStarted
                                              ? "Chưa upload — chọn file bên phải"
                                              : undefined
                                        }
                                        busy={uploadingKey === key}
                                        canEditTrack={canModifyRoundTracks(round)}
                                        onEditTrack={() => openEditTrack(track)}
                                        onRemoveFromRound={
                                          isRoundScopedTracks &&
                                          canModifyRoundTracks(round)
                                            ? () =>
                                                setPendingRemove({ round, track })
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
                                ) : tracksPendingSync.length > 0 ? (
                                  <ul className="space-y-2 px-3 py-4">
                                    {tracksPendingSync.map((track) => (
                                      <li
                                        key={track.id}
                                        className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-sm"
                                      >
                                        <span className="font-medium">{track.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          Chưa gán vào vòng này
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
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
                                  canUpload={isRoundNotStarted && !requirePerTrackProblems}
                                  emptyHint={
                                    !requirePerTrackProblems
                                      ? isRoundNotStarted
                                        ? "Upload một file đề chung cho vòng này"
                                        : undefined
                                      : isDeferred
                                        ? "Round shared — dùng Pool đề nếu cần"
                                        : "Chưa upload — chọn file bên phải"
                                  }
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
  );

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
            <Badge variant={isDeferred ? "default" : "outline"}>
              {isDeferred ? "Flow B · Pool + lottery" : "Flow A · Direct upload"}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Tracks & Rounds</h1>
          <p className="mt-1 text-muted-foreground">
            Create and maintain the competition structure for {event.name}.
          </p>
        </div>
        {isDeferred ? (
          <div className="flex flex-wrap justify-end gap-2">
            <LotteryHeaderButton
              disableReason={phase1DisableReason}
              className="gap-2 bg-orange-600 hover:bg-orange-700"
              onClick={() => {
                if (!defaultCeremonyRound) return;
                setLotteryRound({
                  id: defaultCeremonyRound.id,
                  name: defaultCeremonyRound.name,
                  trackCount: defaultCeremonyRound.trackCount,
                  trackSlots: defaultCeremonyRound.trackSlots,
                });
              }}
            >
              <Shuffle className="h-4 w-4" />
              Random Track (Phase 1)
            </LotteryHeaderButton>
            <LotteryHeaderButton
              disableReason={phase2DisableReason}
              variant="outline"
              className="gap-2 border-orange-500/40 text-orange-600 hover:bg-orange-500/10"
              onClick={() => {
                if (!defaultCeremonyRound) return;
                setTeamLotteryRound({
                  id: defaultCeremonyRound.id,
                  name: defaultCeremonyRound.name,
                  trackCount: defaultCeremonyRound.trackCount,
                  trackSlots: defaultCeremonyRound.trackSlots,
                });
              }}
            >
              <Shuffle className="h-4 w-4" />
              Bốc thăm đội (Phase 2)
              {event.studentTrackDrawOpen ? " · SV đang bốc" : ""}
            </LotteryHeaderButton>
          </div>
        ) : null}
      </div>

      {isDeferred ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div
            role="tablist"
            aria-label="Tracks workspace"
            className="grid grid-cols-2 border-b border-border"
          >
            {workspaceTabs.map(({ id, label, icon: Icon }) => {
              const active = tracksTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTracksTab(id)}
                  className={cn(
                    "flex items-center gap-2 border-r border-border px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide transition-colors last:border-r-0",
                    active
                      ? "bg-orange-500/10 text-orange-700 dark:text-orange-300"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      active ? "text-orange-500" : "text-muted-foreground/70",
                    )}
                  />
                  {label}
                </button>
              );
            })}
          </div>

          <div role="tabpanel">
            {tracksTab === "rounds" ? (
              roundsPanel(true)
            ) : (
              <TracksProblemPoolTab
                eventId={eventId}
                embedded
                maxTeams={event.maxTeams}
                minPoolNeeded={rounds.reduce(
                  (max, r) =>
                    Math.max(max, (r.trackProblems ?? []).length),
                  0,
                )}
                unassignedPoolCount={unassignedPoolCount}
              />
            )}
          </div>
        </div>
      ) : (
        roundsPanel()
      )}

      <ProblemLotteryDialog
        open={lotteryRound != null}
        onOpenChange={(open) => {
          if (!open) setLotteryRound(null);
        }}
        eventId={eventId}
        roundId={lotteryRound?.id ?? 0}
        roundName={lotteryRound?.name ?? ""}
        trackCount={lotteryRound?.trackCount ?? 0}
        trackSlots={lotteryRound?.trackSlots ?? []}
        previewItems={poolPreviewItems}
        unassignedPoolCount={unassignedPoolCount}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["organizerEvent", eventId] });
          queryClient.invalidateQueries({ queryKey: ["problemPool", eventId] });
          void eventQuery.refetch();
        }}
      />

      <TeamLotteryDialog
        open={teamLotteryRound != null}
        onOpenChange={(open) => {
          if (!open) setTeamLotteryRound(null);
        }}
        eventId={eventId}
        roundId={teamLotteryRound?.id ?? 0}
        roundName={teamLotteryRound?.name ?? ""}
        trackCount={teamLotteryRound?.trackCount ?? 0}
        trackSlots={teamLotteryRound?.trackSlots ?? []}
        studentTrackDrawOpen={Boolean(event.studentTrackDrawOpen)}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["organizerEvent", eventId] });
          queryClient.invalidateQueries({ queryKey: ["organizerTeams", eventId] });
          queryClient.invalidateQueries({
            queryKey: ["lotteryTeamsPreview", eventId],
          });
          void eventQuery.refetch();
        }}
      />

      <RoundDialog
        open={isRoundDialogOpen}
        onOpenChange={setIsRoundDialogOpen}
        draft={roundDraft}
        setDraft={setRoundDraft}
        isSaving={saveStructureMutation.isPending}
        onSave={saveRound}
        deferredTrackAssignment={Boolean(event.deferredTrackAssignment)}
        allRounds={rounds}
        prizeSlotCount={(event.prizes ?? []).reduce(
          (sum, p) => sum + (p.quantity ?? 1),
          0,
        )}
      />

      <TrackDialog
        open={isTrackDialogOpen}
        onOpenChange={setIsTrackDialogOpen}
        draft={trackDraft}
        setDraft={setTrackDraft}
        isSaving={roundTrackMutation.isPending}
        onSave={saveTrack}
      />

      <Dialog
        open={pendingRemove != null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove track from round?</DialogTitle>
            <DialogDescription>
              {pendingRemove ? (
                <>
                  Remove <strong>{pendingRemove.track.name}</strong> from Round{" "}
                  {pendingRemove.round.roundNumber}?
                  {pendingRemove.round.trackProblems?.some(
                    (p) =>
                      p.trackId === pendingRemove.track.id &&
                      !!p.problemFileUrl?.trim(),
                  ) ? (
                    <>
                      {" "}
                      The uploaded problem file for this track in this round
                      will also be removed.
                    </>
                  ) : null}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingRemove(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={uploadingKey != null}
              onClick={() => void confirmRemoveTrackFromRound()}
            >
              {uploadingKey ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Remove"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  allRounds,
  prizeSlotCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: RoundDraft;
  setDraft: React.Dispatch<React.SetStateAction<RoundDraft>>;
  isSaving: boolean;
  onSave: () => void;
  deferredTrackAssignment: boolean;
  allRounds: OrganizerRound[];
  prizeSlotCount: number;
}) {
  const isLastRound = isLastRoundDraft(draft, allRounds);
  const isTrackSpecific = draft.isTrackSpecific;

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

          {deferredTrackAssignment ? (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm md:col-span-2">
              <strong className="text-foreground">Luồng B — thi theo track</strong>
              <p className="mt-1 text-muted-foreground">
                Mọi vòng đều theo bảng: đội bốc được track nào thì thi track đó
                tới hết (chung kết vẫn theo bảng). Mỗi vòng upload đề riêng và
                cấu hình tiêu chí chấm riêng.
              </p>
            </div>
          ) : (
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
                Bật: mỗi track một đề. Tắt: một file đề chung cho cả vòng.
              </span>
            </span>
          </label>
          )}

          {isLastRound ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm md:col-span-2">
              <strong className="text-foreground">Final round</strong>
              <p className="mt-1 text-muted-foreground">
                No advance count — winners are chosen from{" "}
                <strong>Event → Prizes</strong>
                {prizeSlotCount > 0
                  ? ` (${prizeSlotCount} prize slot${prizeSlotCount === 1 ? "" : "s"} configured)`
                  : " (add prizes when creating or editing the event)"}
                . Publish on the Rankings page auto-assigns awards by rank.
              </p>
            </div>
          ) : (
            <Field
              label={`Top N advance ${isTrackSpecific ? "(per track)" : "(whole round)"} *`}
            >
              <Input
                type="number"
                min={1}
                step={1}
                placeholder="e.g. 2, 3, 4"
                value={draft.advanceCount}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    advanceCount: event.target.value,
                  }))
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Tùy cuộc thi — ví dụ top 2/bảng, top 3, top 4…
              </p>
            </Field>
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
  emptyHint,
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
  emptyHint?: string;
  busy: boolean;
  canEditTrack?: boolean;
  onEditTrack?: () => void;
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
            title="Remove this track from this round"
            onClick={onRemoveFromRound}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove from round
          </Button>
        ) : null}

        {fileUrl ? (
          <>
            <span
              title="Đã có đề — bảng này đã được gán / upload file đề bài."
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
            >
              <Check className="h-4 w-4" aria-label="Has problem file" />
            </span>
            <ProblemStatementViewer
              compact
              fileUrl={fileUrl}
              title="Problem Statement"
              trackName={name === "All tracks (shared)" ? null : name}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-orange-500/40 bg-background px-3 text-sm font-semibold text-orange-500 no-underline hover:bg-orange-500/10 hover:text-orange-600"
            />
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
            ) : null}
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
            title={
              emptyHint ??
              "Chưa có đề — bảng này chưa được gán / upload file đề bài."
            }
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 text-red-500"
          >
            <X className="h-4 w-4" aria-label="Missing problem file" />
          </span>
        )}
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
