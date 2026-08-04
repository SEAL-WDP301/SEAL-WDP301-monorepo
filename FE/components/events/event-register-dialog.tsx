"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus, Trash2, X } from "lucide-react";
import { enqueueSnackbar } from "notistack";
import { z } from "zod";
import { axiosClient } from "@/lib/axios";
import { useAuthStore } from "@/lib/stores/auth.store";
import {
  ensureRequiredEmailSlots,
  normalizeTeamMemberEmail,
  validateTeamMemberEmails,
} from "@/lib/team-registration-validation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PublicEvent {
  id: number;
  name: string;
  status?: string | null;
  registrationDeadline?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  maxTeams?: number | null;
  minMembersPerTeam?: number;
  maxMembersPerTeam?: number;
  registeredTeams?: number;
  remainingTeamSlots?: number | null;
  isTeamRegistrationFull?: boolean;
  deferredTrackAssignment?: boolean;
  tracks?: Array<{ id: number; name: string }>;
}

interface TeamMember {
  role?: string | null;
  user?: { email?: string | null } | null;
}

interface RegisterPayload {
  trackId?: number | null;
  teamName: string;
  memberEmails: string[];
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getRegistrationBlockReason(
  event?: PublicEvent | null,
  isEditingExistingTeam = false,
) {
  if (!event) return "Event information is unavailable.";

  const normalizedStatus = event.status?.toLowerCase();
  if (normalizedStatus !== "active") {
    return "Registration is closed because this event is not active.";
  }

  const now = new Date();
  if (event.registrationDeadline) {
    const deadline = new Date(event.registrationDeadline);
    if (!Number.isNaN(deadline.getTime()) && now > deadline) {
      return `Registration deadline passed on ${formatDateTime(event.registrationDeadline)}.`;
    }
  }

  if (event.startDate) {
    const startDate = new Date(event.startDate);
    if (!Number.isNaN(startDate.getTime()) && now >= startDate) {
      return `Registration is closed because the event started on ${formatDateTime(event.startDate)}.`;
    }
  }

  if (!isEditingExistingTeam && event.isTeamRegistrationFull) {
    return `This event has reached its team capacity (${event.registeredTeams ?? event.maxTeams}/${event.maxTeams} teams).`;
  }

  // Flow A: must pick a track — block if catalog is empty (do not pretend deferred).
  const deferred = Boolean(event.deferredTrackAssignment);
  const hasTracks = (event.tracks?.length ?? 0) > 0;
  if (!deferred && !hasTracks) {
    return "This event has no tracks configured yet. Registration opens after the organizer adds tracks.";
  }

  return null;
}

type EventRegisterDialogProps = {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EventRegisterDialog({
  eventId,
  open,
  onOpenChange,
}: EventRegisterDialogProps) {
  const queryClient = useQueryClient();
  const currentUserEmail = useAuthStore((state) => state.user?.email ?? "");

  const [teamName, setTeamName] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<number | null>(null);
  const [memberEmails, setMemberEmails] = useState<string[]>([""]);

  const { data: event, isLoading: isEventLoading } = useQuery({
    queryKey: ["publicEvent", eventId],
    queryFn: async () => {
      const res = await axiosClient.get(`/public/events/${eventId}`);
      return res.data.data as PublicEvent;
    },
    enabled: open,
  });

  const { data: studentInfo, isLoading: isStudentLoading } = useQuery({
    queryKey: ["studentEventStatus", eventId],
    queryFn: async () => {
      const res = await axiosClient.get(`/student/teams/status/${eventId}`);
      return res.data.data;
    },
    enabled: open,
  });

  const teamStatus = studentInfo?.teamInfo?.team?.status;
  const isEditing =
    !!studentInfo?.teamInfo &&
    teamStatus !== "rejected" &&
    teamStatus !== "disqualified";

  useEffect(() => {
    if (!open || !studentInfo?.teamInfo?.team) return;
    setTeamName(studentInfo.teamInfo.team.name);
    setSelectedTrack(studentInfo.teamInfo.team.trackId ?? null);
    if (studentInfo.teamInfo.team.members) {
      const otherMembers = studentInfo.teamInfo.team.members
        .filter((m: TeamMember) => m.role === "member")
        .map((m: TeamMember) => m.user?.email)
        .filter(Boolean);
      setMemberEmails(
        ensureRequiredEmailSlots(
          otherMembers,
          event?.minMembersPerTeam ?? 1,
          event?.maxMembersPerTeam ?? 4,
        ),
      );
    }
  }, [open, studentInfo, event?.minMembersPerTeam, event?.maxMembersPerTeam]);

  const registrationBlockReason = getRegistrationBlockReason(event, isEditing);
  const isRegistrationBlocked = Boolean(registrationBlockReason);
  // Only Flow B (flag). Do not treat "0 visible tracks" as deferred.
  const deferred = Boolean(event?.deferredTrackAssignment);
  const minMembersPerTeam = event?.minMembersPerTeam ?? 1;
  const maxMembersPerTeam = event?.maxMembersPerTeam ?? 4;
  const maxAdditionalMembers = maxMembersPerTeam - 1;
  const requiredEmailSlots = Math.max(0, minMembersPerTeam - 1);
  const emailErrors = useMemo(
    () =>
      validateTeamMemberEmails(
        memberEmails,
        currentUserEmail,
        requiredEmailSlots,
      ),
    [memberEmails, currentUserEmail, requiredEmailSlots],
  );
  const hasEmailErrors = emailErrors.some(Boolean);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      setMemberEmails((previous) =>
        ensureRequiredEmailSlots(
          previous,
          minMembersPerTeam,
          maxMembersPerTeam,
        ),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [open, minMembersPerTeam, maxMembersPerTeam]);

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterPayload) => {
      const blockReason = getRegistrationBlockReason(event, isEditing);
      if (blockReason) throw new Error(blockReason);
      if (isEditing) {
        return axiosClient.put(`/student/teams/register/team/${eventId}`, data);
      }
      return axiosClient.post(`/student/teams/register/team/${eventId}`, data);
    },
    onSuccess: () => {
      enqueueSnackbar(
        isEditing
          ? "Team updated successfully!"
          : "Team registered successfully!",
        { variant: "success" },
      );
      queryClient.invalidateQueries({
        queryKey: ["studentEventStatus", eventId],
      });
      queryClient.invalidateQueries({ queryKey: ["publicEvent", eventId] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const apiError = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      enqueueSnackbar(
        apiError.response?.data?.message ||
          apiError.message ||
          "Registration failed",
        { variant: "error" },
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const blockReason = getRegistrationBlockReason(event, isEditing);
    if (blockReason) {
      enqueueSnackbar(blockReason, { variant: "warning" });
      return;
    }

    const teamNameResult = z.string().min(2, "Team name must be at least 2 characters").max(50, "Team name is too long").safeParse(teamName.trim());
    if (!teamNameResult.success) {
      enqueueSnackbar(teamNameResult.error.issues[0]?.message || "Invalid team name", { variant: "warning" });
      return;
    }

    if (!deferred && !selectedTrack) {
      enqueueSnackbar("Please select a track", { variant: "warning" });
      return;
    }
    if (hasEmailErrors) {
      enqueueSnackbar("Please fix the member email errors before submitting.", {
        variant: "warning",
      });
      return;
    }

    const validEmails = memberEmails
      .map(normalizeTeamMemberEmail)
      .filter(Boolean);
    const requestedTeamSize = validEmails.length + 1;
    if (
      requestedTeamSize < minMembersPerTeam ||
      requestedTeamSize > maxMembersPerTeam
    ) {
      enqueueSnackbar(
        `A team must have between ${minMembersPerTeam} and ${maxMembersPerTeam} members, including the leader.`,
        { variant: "warning" },
      );
      return;
    }

    registerMutation.mutate({
      ...(deferred ? {} : { trackId: selectedTrack }),
      teamName,
      memberEmails: validEmails,
    });
  };

  const addEmailField = () => {
    if (isRegistrationBlocked) {
      enqueueSnackbar(registrationBlockReason, { variant: "warning" });
      return;
    }
    if (!deferred && !selectedTrack) {
      enqueueSnackbar("Please select a track before adding a member.", {
        variant: "warning",
      });
      return;
    }
    if (memberEmails.length >= maxAdditionalMembers) {
      enqueueSnackbar(
        `This event allows at most ${maxMembersPerTeam} members per team, including you.`,
        { variant: "warning" },
      );
      return;
    }
    setMemberEmails([...memberEmails, ""]);
  };

  const removeEmailField = (index: number) => {
    const next = [...memberEmails];
    next.splice(index, 1);
    setMemberEmails(next);
  };

  const updateEmail = (index: number, value: string) => {
    const next = [...memberEmails];
    next[index] = value;
    setMemberEmails(next);
  };

  const isLoading = isEventLoading || isStudentLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border p-0 sm:p-0"
      >
        <div className="relative overflow-hidden rounded-xl">
          <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-orange-500/10 blur-[80px]" />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 z-50"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="relative z-10 p-6 sm:p-8">
            <DialogHeader className="mb-6 space-y-2 pr-8 text-left">
              <DialogTitle className="text-2xl font-black text-foreground sm:text-3xl">
                Team Registration
              </DialogTitle>
              <DialogDescription>
                {event ? (
                  <>
                    Register your team for <strong>{event.name}</strong>
                  </>
                ) : (
                  "Register your team for this event."
                )}
              </DialogDescription>
            </DialogHeader>

            {isLoading || !event ? (
              <div className="flex justify-center py-16">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500" />
              </div>
            ) : (
              <>
                {event.maxTeams != null && (
                  <div className="mb-6 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
                    <p className="font-semibold text-foreground">
                      Team capacity: {event.registeredTeams ?? 0}/
                      {event.maxTeams}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {event.isTeamRegistrationFull
                        ? isEditing
                          ? "The event is full, but you can still update your existing team and invite members."
                          : "The event is full and no new teams can be created."
                        : `${event.remainingTeamSlots ?? event.maxTeams} team slots remaining.`}
                    </p>
                  </div>
                )}

                <div className="mb-6 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
                  <p className="font-semibold text-foreground">Team size</p>
                  <p className="mt-1 text-muted-foreground">
                    Each team must have {minMembersPerTeam}-{maxMembersPerTeam}{" "}
                    members, including the leader.
                  </p>
                </div>

                {registrationBlockReason && (
                  <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                    <div>
                      <p className="font-semibold text-red-100">
                        Registration unavailable
                      </p>
                      <p className="mt-1 text-red-100/80">
                        {registrationBlockReason}
                      </p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {deferred ? (
                    <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm">
                      <p className="font-semibold text-foreground">
                        Tracks stay hidden for now
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Register your team without choosing a track. When the
                        organizer opens a round, your team is assigned a track
                        at random and receives that track&apos;s problem file.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <label className="text-sm font-semibold text-foreground">
                        Select Competition Track *
                      </label>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {event.tracks?.map((track) => (
                          <div
                            key={track.id}
                            onClick={() => {
                              if (!isRegistrationBlocked) {
                                setSelectedTrack(track.id);
                              }
                            }}
                            className={`rounded-xl border p-4 transition-all ${
                              isRegistrationBlocked
                                ? "cursor-not-allowed opacity-50"
                                : "cursor-pointer"
                            } ${
                              selectedTrack === track.id
                                ? "border-orange-500 bg-orange-500/10 ring-1 ring-orange-500"
                                : "border-border bg-muted/50 hover:border-orange-500/50"
                            }`}
                          >
                            <div className="mb-1 font-semibold text-foreground">
                              {track.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Event team policy: {minMembersPerTeam}-
                              {maxMembersPerTeam} members
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">
                      Team Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      disabled={isRegistrationBlocked}
                      placeholder="Enter your awesome team name"
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-foreground">
                        Invite Members
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addEmailField}
                        className="h-8"
                        disabled={
                          isRegistrationBlocked ||
                          (!deferred && !selectedTrack) ||
                          memberEmails.length >= maxAdditionalMembers
                        }
                      >
                        <Plus className="mr-1 h-4 w-4" /> Add Member
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      You are automatically included as Team Leader. The first{" "}
                      {requiredEmailSlots} email field
                      {requiredEmailSlots === 1 ? " is" : "s are"} required.
                      Invitees may register for SEAL after receiving the email.
                    </p>

                    <div className="space-y-3">
                      {memberEmails.map((email, index) => (
                        <div
                          key={index}
                          className="flex flex-wrap items-center gap-3"
                        >
                          <input
                            type="email"
                            value={email}
                            onChange={(e) =>
                              updateEmail(index, e.target.value)
                            }
                            disabled={isRegistrationBlocked}
                            placeholder={`Member ${index + 1} Email`}
                            aria-invalid={Boolean(emailErrors[index])}
                            className={`flex-1 rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                              emailErrors[index]
                                ? "border-red-500 focus:ring-red-500/40"
                                : "border-border focus:ring-orange-500/50"
                            }`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeEmailField(index)}
                            disabled={
                              isRegistrationBlocked ||
                              index < requiredEmailSlots
                            }
                            className="rounded-xl text-red-400 hover:bg-red-400/10 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {emailErrors[index] && (
                            <p className="basis-full pl-1 text-xs text-red-500">
                              {emailErrors[index]}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-xl shadow-orange-500/20 hover:from-orange-600 hover:to-rose-600"
                      disabled={
                        isRegistrationBlocked ||
                        registerMutation.isPending ||
                        hasEmailErrors
                      }
                    >
                      {registrationBlockReason
                        ? "Registration Closed"
                        : registerMutation.isPending
                          ? "Registering..."
                          : "Submit Registration"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
