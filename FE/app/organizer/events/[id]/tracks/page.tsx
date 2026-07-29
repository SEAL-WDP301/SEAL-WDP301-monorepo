"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { enqueueSnackbar } from "notistack";
import { Edit2, Loader2, Plus, Save, Trash2, PlayCircle, ExternalLink, Upload } from "lucide-react";

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
  maxTeams: number | string;
  maxMembersPerTeam: number | string;
};

const emptyRound = (roundNumber: number): RoundDraft => ({
  roundNumber,
  name: "",
  trackId: "",
  submissionType: "file",
  submissionDeadline: "",
  maxFileSizeMb: 20,
  isTrackSpecific: true,
});

const emptyTrack = (): TrackDraft => ({
  name: "",
  description: "",
  maxTeams: 50,
  maxMembersPerTeam: 4,
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

function optionalNumber(value: number | string) {
  if (value === "") return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
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
    maxTeams: track.maxTeams,
    maxMembersPerTeam: track.maxMembersPerTeam,
  };
}

function buildEventPayload(
  event: OrganizerEvent,
  tracks: OrganizerTrackInput[],
  rounds: OrganizerRoundInput[]
): OrganizerEventPayload {
  return {
    name: event.name,
    description: event.description || undefined,
    season: event.season,
    year: event.year,
    status: event.status,
    registrationDeadline: event.registrationDeadline || undefined,
    startDate: event.startDate || undefined,
    endDate: event.endDate || undefined,
    githubOrgUrl: event.githubOrgUrl || undefined,
    prizes: event.prizes?.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      quantity: p.quantity,
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

  const eventQuery = useQuery({
    queryKey: ["organizerEvent", eventId],
    queryFn: () => getOrganizerEvent(eventId),
  });

  const event = eventQuery.data;
  const rounds = useMemo(
    () => [...(event?.rounds || [])].sort((a, b) => a.roundNumber - b.roundNumber),
    [event?.rounds]
  );
  const tracks = useMemo(() => event?.tracks || [], [event?.tracks]);

  const canModifyStructure =
    event?.status === "draft" &&
    (!event.registrationDeadline || new Date(event.registrationDeadline) > new Date());

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
        throw new Error("Rounds and tracks can only be changed before registration closes.");
      }
      return updateOrganizerEvent(
        eventId,
        buildEventPayload(event, nextTracks, nextRounds)
      );
    },
    onSuccess: (updatedEvent) => {
      queryClient.setQueryData(["organizerEvent", eventId], updatedEvent);
      queryClient.invalidateQueries({ queryKey: ["organizerEvent", eventId] });
    },
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "Failed to update event structure"), {
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
        { status }
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      enqueueSnackbar("Round status updated", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["organizerEvent", eventId] });
      queryClient.invalidateQueries({ queryKey: ["detailedRankings", eventId, String(variables.roundId)] });
      queryClient.invalidateQueries({ queryKey: ["organizerTeams", eventId] });
      queryClient.invalidateQueries({ queryKey: ["organizerSubmissions", eventId, String(variables.roundId)] });
    },
    onError: (error) => {
      enqueueSnackbar(getApiMessage(error, "Failed to update round status"), {
        variant: "error",
      });
    },
  });

  const [uploadingRoundId, setUploadingRoundId] = useState<number | null>(null);

  const handleProblemFileUpload = async (roundId: number, file: File) => {
    try {
      setUploadingRoundId(roundId);
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await axiosClient.post("/storage/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const fileUrl = uploadRes.data?.data?.fileUrl;
      if (!fileUrl) throw new Error("Upload failed: No file URL returned");

      await updateRoundProblemFile(eventId, roundId, fileUrl);
      enqueueSnackbar("Problem statement file uploaded successfully!", { variant: "success" });
      eventQuery.refetch();
    } catch (err: any) {
      enqueueSnackbar(getApiMessage(err, "Failed to upload problem file"), { variant: "error" });
    } finally {
      setUploadingRoundId(null);
    }
  };

  const handleRemoveProblemFile = async (roundId: number) => {
    try {
      setUploadingRoundId(roundId);
      await updateRoundProblemFile(eventId, roundId, null);
      enqueueSnackbar("Problem statement file removed.", { variant: "info" });
      eventQuery.refetch();
    } catch (err: any) {
      enqueueSnackbar(getApiMessage(err, "Failed to remove problem file"), { variant: "error" });
    } finally {
      setUploadingRoundId(null);
    }
  };

  const openCreateRound = () => {
    const nextRoundNumber =
      rounds.length === 0 ? 1 : Math.max(...rounds.map((round) => round.roundNumber)) + 1;
    setRoundDraft(emptyRound(nextRoundNumber));
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
            round.name.trim().toLowerCase() === normalizedName.toLowerCase())
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
      isTrackSpecific: roundDraft.isTrackSpecific,
    };

    const nextRounds = roundDraft.id
      ? rounds.map((round) => (round.id === roundDraft.id ? savedRound : mapRound(round)))
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
      }
    );
  };

  const deleteRound = (round: OrganizerRound) => {
    const submissionCount = round._count?.submissions ?? 0;
    if (submissionCount > 0) {
      enqueueSnackbar("This round cannot be deleted because it has submissions.", {
        variant: "error",
      });
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
      }
    );
  };

  const openCreateTrack = () => {
    setTrackDraft(emptyTrack());
    setIsTrackDialogOpen(true);
  };

  const openEditTrack = (track: OrganizerTrack) => {
    setTrackDraft({
      id: track.id,
      name: track.name,
      description: track.description || "",
      maxTeams: track.maxTeams ?? "",
      maxMembersPerTeam: track.maxMembersPerTeam ?? 4,
    });
    setIsTrackDialogOpen(true);
  };

  const saveTrack = () => {
    if (!event) return;

    const normalizedName = trackDraft.name.trim();
    const maxTeams = optionalNumber(trackDraft.maxTeams);
    const maxMembersPerTeam = optionalNumber(trackDraft.maxMembersPerTeam);

    if (!normalizedName) {
      enqueueSnackbar("Track name is required.", { variant: "warning" });
      return;
    }
    if (
      maxTeams !== undefined &&
      (!Number.isInteger(maxTeams) || maxTeams < 1)
    ) {
      enqueueSnackbar("Max teams must be a positive integer.", {
        variant: "warning",
      });
      return;
    }
    if (
      maxMembersPerTeam === undefined ||
      !Number.isInteger(maxMembersPerTeam) ||
      maxMembersPerTeam < 3 ||
      maxMembersPerTeam > 5
    ) {
      enqueueSnackbar("Team size must be between 3 and 5 members.", {
        variant: "warning",
      });
      return;
    }
    if (
      tracks.some(
        (track) =>
          track.id !== trackDraft.id &&
          track.name.trim().toLowerCase() === normalizedName.toLowerCase()
      )
    ) {
      enqueueSnackbar("Track name must be unique.", { variant: "warning" });
      return;
    }

    const savedTrack: OrganizerTrackInput = {
      id: trackDraft.id,
      name: normalizedName,
      description: trackDraft.description.trim() || undefined,
      maxTeams,
      maxMembersPerTeam,
    };

    const nextTracks = trackDraft.id
      ? tracks.map((track) => (track.id === trackDraft.id ? savedTrack : mapTrack(track)))
      : [...tracks.map(mapTrack), savedTrack];

    saveStructureMutation.mutate(
      {
        nextTracks,
        nextRounds: rounds.map(mapRound),
      },
      {
        onSuccess: () => {
          enqueueSnackbar(trackDraft.id ? "Track updated" : "Track created", {
            variant: "success",
          });
          setIsTrackDialogOpen(false);
        },
      }
    );
  };

  const deleteTrack = (track: OrganizerTrack) => {
    const teamCount = track._count?.teams ?? 0;
    const usedByRound = rounds.some((round) => round.trackId === track.id);

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
      }
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
            <Badge variant="outline">{event.season} {event.year}</Badge>
            <Badge variant={event.status === "draft" ? "warning" : "success"} className="capitalize">
              {event.status}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Tracks & Rounds</h1>
          <p className="mt-1 text-muted-foreground">
            Create and maintain the competition structure for {event.name}.
          </p>
        </div>
      </div>

      <GlassCard className="rounded-[24px] p-6">
        <SectionHeader
          title="Event Rounds"
          description={`${rounds.length} configured round${rounds.length === 1 ? "" : "s"}`}
          action={
            <div title={!canModifyStructure ? "Tracks and rounds are read-only. They can only be changed while the event is draft and registration is still open." : undefined}>
              <Button
                type="button"
                size="sm"
                className="gap-2 bg-blue-600 hover:bg-blue-700"
                disabled={!canModifyStructure || saveStructureMutation.isPending}
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
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-4 font-semibold">Round</th>
                  <th className="px-5 py-4 font-semibold">Track</th>
                  <th className="px-5 py-4 font-semibold">Deadline</th>
                  <th className="px-5 py-4 font-semibold">Submission</th>
                  <th className="px-5 py-4 font-semibold">Problem File</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((round) => {
                  const track = tracks.find((item) => item.id === round.trackId);
                  const isRoundNotStarted = (round.status || "not_started") === "not_started";
                  return (
                    <tr 
                      key={round.id} 
                      className="border-t border-border hover:bg-white/[0.02] cursor-pointer transition-colors"
                      onClick={() => router.push(`/organizer/events/${eventId}/rounds/${round.id}/teams`)}
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold">{round.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Round {round.roundNumber}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {round.isTrackSpecific ? (
                          <Badge variant="default">Track-specific</Badge>
                        ) : (
                          <Badge variant="outline">All tracks combined</Badge>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        {round.submissionDeadline
                          ? new Date(round.submissionDeadline).toLocaleString()
                          : "Not configured"}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        <div className="font-medium capitalize">
                          {round.submissionType.replace("_", " ")}
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          Max {round.maxFileSizeMb ?? 20} MB
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs" onClick={(e) => e.stopPropagation()}>
                        {round.problemFileUrl ? (
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs">
                              <a href={round.problemFileUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 text-orange-500" /> Topic File
                              </a>
                            </Button>
                            {isRoundNotStarted ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Remove Problem File"
                                disabled={uploadingRoundId === round.id}
                                onClick={() => handleRemoveProblemFile(round.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            ) : (
                              <span
                                title="Locked: Problem file can only be modified when round status is Not Started"
                                className="text-[10px] text-muted-foreground italic border border-border px-1.5 py-0.5 rounded cursor-help"
                              >
                                Locked
                              </span>
                            )}
                          </div>
                        ) : (
                          isRoundNotStarted ? (
                            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                              {uploadingRoundId === round.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" />
                              ) : (
                                <Upload className="h-3.5 w-3.5 text-orange-500" />
                              )}
                              <span>Upload Topic</span>
                              <input
                                type="file"
                                className="hidden"
                                disabled={uploadingRoundId === round.id}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleProblemFileUpload(round.id, f);
                                }}
                              />
                            </label>
                          ) : (
                            <span
                              title="Locked: Problem file can only be modified when round status is Not Started"
                              className="text-xs text-muted-foreground italic cursor-help"
                            >
                              No File (Locked)
                            </span>
                          )
                        )}
                      </td>
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={round.status || "not_started"}
                          disabled={updateRoundStatusMutation.isPending}
                          onChange={(event) =>
                            updateRoundStatusMutation.mutate({
                              roundId: round.id,
                              status: event.target.value,
                            })
                          }
                          className="h-9 rounded-lg border border-input bg-background px-3 text-sm capitalize"
                        >
                          <option value="not_started">Not Started</option>
                          <option value="open">Open</option>
                          <option value="closed">Closed</option>
                          <option value="results_published">Results Published</option>
                        </select>
                      </td>
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <div 
                          className="flex justify-end gap-2"
                          title={!canModifyStructure ? "Tracks and rounds are read-only. They can only be changed while the event is draft and registration is still open." : undefined}
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            title="Edit round"
                            disabled={!canModifyStructure || saveStructureMutation.isPending}
                            onClick={() => openEditRound(round)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Delete round"
                            disabled={!canModifyStructure || saveStructureMutation.isPending}
                            onClick={() => deleteRound(round)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="No rounds configured. Add the first round to define a submission stage." />
        )}
      </GlassCard>

      <GlassCard className="rounded-[24px] p-6">
        <SectionHeader
          title="Event Tracks"
          description={`${tracks.length} configured track${tracks.length === 1 ? "" : "s"}`}
          action={
            <div title={!canModifyStructure ? "Tracks and rounds are read-only. They can only be changed while the event is draft and registration is still open." : undefined}>
              <Button
                type="button"
                size="sm"
                className="gap-2 bg-orange-600 hover:bg-orange-700"
                disabled={!canModifyStructure || saveStructureMutation.isPending}
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
            {tracks.map((track) => (
              <div
                key={track.id}
                className="flex min-h-48 flex-col rounded-2xl border border-border bg-background/60 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold">{track.name}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {track.description || "No description provided."}
                    </p>
                  </div>
                  <div 
                    className="flex shrink-0 gap-1"
                    title={!canModifyStructure ? "Tracks and rounds are read-only. They can only be changed while the event is draft and registration is still open." : undefined}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      title="Edit track"
                      disabled={!canModifyStructure || saveStructureMutation.isPending}
                      onClick={() => openEditTrack(track)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Delete track"
                      disabled={!canModifyStructure || saveStructureMutation.isPending}
                      onClick={() => deleteTrack(track)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>

                <div className="mt-auto grid grid-cols-3 gap-3 pt-5 text-center">
                  <TrackStat label="Teams" value={track._count?.teams ?? 0} />
                  <TrackStat label="Max teams" value={track.maxTeams ?? "∞"} />
                  <TrackStat
                    label="Team size"
                    value={track.maxMembersPerTeam ?? 5}
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
        tracks={tracks}
        isSaving={saveStructureMutation.isPending}
        onSave={saveRound}
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
  tracks,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: RoundDraft;
  setDraft: React.Dispatch<React.SetStateAction<RoundDraft>>;
  tracks: OrganizerTrack[];
  isSaving: boolean;
  onSave: () => void;
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
                setDraft((current) => ({ ...current, name: event.target.value }))
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



          <label className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={draft.isTrackSpecific}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  isTrackSpecific: event.target.checked,
                }))
              }
              className="h-4 w-4"
            />
            <span>
              <strong>Track-specific round</strong>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Disable this option for a shared final round that applies to all tracks.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
                setDraft((current) => ({ ...current, name: event.target.value }))
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

          <div className="grid grid-cols-2 gap-4">
            <Field label="Max teams">
              <Input
                type="number"
                min={1}
                value={draft.maxTeams}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    maxTeams: event.target.value,
                  }))
                }
              />
            </Field>

            <Field label="Max members (3–5) *">
              <Input
                type="number"
                min={3}
                max={5}
                value={draft.maxMembersPerTeam}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    maxMembersPerTeam: event.target.value,
                  }))
                }
              />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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

function TrackStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2">
      <div className="text-base font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
