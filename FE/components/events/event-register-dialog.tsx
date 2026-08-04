"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Info, Plus, Trash2, X } from "lucide-react";
import { enqueueSnackbar } from "notistack";
import { z } from "zod";
import { axiosClient } from "@/lib/axios";
import { useAuthStore } from "@/lib/stores/auth.store";
import {
  ensureRequiredEmailSlots,
  getRequiredEmailGuidance,
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
    const frame = requestAnimationFrame(() => {
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
    });
    return () => cancelAnimationFrame(frame);
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
  const isTeamNameEmpty = teamName.trim().length === 0;
  const missingTrack = !deferred && !selectedTrack;
  const submitDisabledReason = registrationBlockReason
    ? registrationBlockReason
    : isTeamNameEmpty
      ? "Enter a team name to submit."
      : missingTrack
        ? "Select a competition track to submit."
        : hasEmailErrors
          ? "Fix the member email errors to submit."
          : null;

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
          ? "Team updated successfully."
          : "Team registered successfully.",
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
    if (isTeamNameEmpty) {
      enqueueSnackbar("Please enter a team name.", { variant: "warning" });
      return;
    }
    if (missingTrack) {
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
        className="max-h-[92dvh] overflow-y-auto rounded-3xl border-border bg-popover p-0 shadow-2xl shadow-black/30 sm:max-w-[760px] sm:p-0"
      >
        <div className="relative overflow-hidden rounded-3xl">
          <Button
            type="button"
            variant="ghost"
            size="auto"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 z-50 h-11 w-11 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground sm:right-6 sm:top-6"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </Button>
          <div className="p-5 sm:p-8 lg:p-10">
            <DialogHeader className="mb-8 space-y-2 pr-12 text-left">
              <DialogTitle className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                Team Registration
              </DialogTitle>
              <DialogDescription className="text-base text-foreground/70 sm:text-lg">
                {event ? (
                  <>
                    For{" "}
                    <strong className="font-semibold text-foreground">
                      {event.name}
                    </strong>
                  </>
                ) : (
                  "Register your team for this event"
                )}
              </DialogDescription>
            </DialogHeader>

            {isLoading || !event ? (
              <div
                className="flex justify-center py-16"
                role="status"
                aria-label="Loading registration form"
              >
                <div
                  className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500"
                  aria-hidden="true"
                />
              </div>
            ) : (
              <>
                <div className="mb-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
                  <div className="rounded-2xl border border-border bg-background/70 p-5">
                    <p className="text-sm font-medium text-muted-foreground">
                      Team Slots
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground sm:text-2xl">
                      {event.maxTeams != null
                        ? `${event.registeredTeams ?? 0} of ${event.maxTeams} used`
                        : `${event.registeredTeams ?? 0} registered`}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/70 p-5">
                    <p className="text-sm font-medium text-muted-foreground">
                      Team Size
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground sm:text-2xl">
                      {minMembersPerTeam} to {maxMembersPerTeam} members
                    </p>
                  </div>
                </div>

                {registrationBlockReason && (
                  <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
                    <AlertCircle
                      className="mt-0.5 h-5 w-5 shrink-0 text-red-400"
                      aria-hidden="true"
                    />
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

                <form onSubmit={handleSubmit} className="space-y-7">
                  {deferred ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/10 p-4 text-sm leading-relaxed text-primary sm:p-5 sm:text-base">
                      <Info
                        className="mt-0.5 h-5 w-5 shrink-0"
                        aria-hidden="true"
                      />
                      <p>
                        Tracks are assigned evenly when the organizer opens
                        round one. You do not pick one now.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p
                        id="competition-track-label"
                        className="text-base font-semibold text-foreground"
                      >
                        Select Competition Track *
                      </p>
                      <div
                        role="radiogroup"
                        aria-labelledby="competition-track-label"
                        className="grid gap-3 sm:grid-cols-2"
                      >
                        {event.tracks?.map((track) => (
                          <button
                            type="button"
                            key={track.id}
                            role="radio"
                            aria-checked={selectedTrack === track.id}
                            disabled={isRegistrationBlocked}
                            onClick={() => {
                              if (!isRegistrationBlocked) {
                                setSelectedTrack(track.id);
                              }
                            }}
                            className={`min-h-20 rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                              isRegistrationBlocked
                                ? "cursor-not-allowed opacity-50"
                                : "cursor-pointer"
                            } ${
                              selectedTrack === track.id
                                ? "border-primary bg-primary/10 ring-1 ring-primary"
                                : "border-border bg-background/70 hover:border-primary/50"
                            }`}
                          >
                            <div className="mb-1 font-semibold text-foreground">
                              {track.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Event team policy: {minMembersPerTeam}-
                              {maxMembersPerTeam} members
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <label
                      htmlFor="team-name"
                      className="text-base font-semibold text-foreground"
                    >
                      Team Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="team-name"
                      name="teamName"
                      type="text"
                      required
                      autoComplete="organization"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      disabled={isRegistrationBlocked}
                      placeholder="Enter your team name…"
                      aria-invalid={isTeamNameEmpty}
                      aria-describedby="team-name-help"
                      className={`h-14 w-full rounded-xl border bg-background/70 px-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                        isTeamNameEmpty
                          ? "border-red-500 focus:ring-red-500/40"
                          : "border-border focus:border-primary/60 focus:ring-primary/35"
                      }`}
                    />
                    <p
                      id="team-name-help"
                      aria-live="polite"
                      className={`text-xs ${
                        isTeamNameEmpty
                          ? "text-red-400"
                          : "text-foreground/70"
                      }`}
                    >
                      {isTeamNameEmpty
                        ? "Team name is required."
                        : "This name will appear on the event team list."}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-base font-semibold text-foreground">
                        Invite Members
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="auto"
                        onClick={addEmailField}
                        className="h-11 touch-manipulation rounded-xl border-border px-4 text-sm hover:border-primary/40 hover:bg-primary/10"
                        disabled={
                          isRegistrationBlocked ||
                          (!deferred && !selectedTrack) ||
                          memberEmails.length >= maxAdditionalMembers
                        }
                      >
                        <Plus
                          className="mr-1 h-4 w-4"
                          aria-hidden="true"
                        />{" "}
                        Add Member
                      </Button>
                    </div>

                    <p className="max-w-[62ch] text-sm leading-relaxed text-foreground/70">
                      You are added automatically as Team Leader. {" "}
                      {getRequiredEmailGuidance(requiredEmailSlots)} Invitations
                      are sent by email.
                    </p>

                    <div className="space-y-3">
                      {memberEmails.map((email, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-end gap-3"
                        >
                          <div className="min-w-0 space-y-2">
                            <label
                              htmlFor={`member-email-${index}`}
                              className="block text-sm font-medium text-foreground/90"
                            >
                              Member {index + 1} Email{" "}
                              <span className="text-foreground/65">
                                {index < requiredEmailSlots
                                  ? "*"
                                  : "(optional)"}
                              </span>
                            </label>
                            <input
                              id={`member-email-${index}`}
                              name={`memberEmails.${index}`}
                              type="email"
                              inputMode="email"
                              autoComplete="off"
                              spellCheck={false}
                              required={index < requiredEmailSlots}
                              value={email}
                              onChange={(e) =>
                                updateEmail(index, e.target.value)
                              }
                              disabled={isRegistrationBlocked}
                              placeholder="name@example.com"
                              aria-invalid={Boolean(emailErrors[index])}
                              aria-describedby={`member-email-${index}-help`}
                              className={`h-14 w-full rounded-xl border bg-background/70 px-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                                emailErrors[index]
                                  ? "border-red-500 focus:ring-red-500/40"
                                  : "border-border focus:border-primary/60 focus:ring-primary/35"
                              }`}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="auto"
                            aria-label={`Remove member ${index + 1} email`}
                            onClick={() => removeEmailField(index)}
                            disabled={
                              isRegistrationBlocked ||
                              index < requiredEmailSlots
                            }
                            className="h-14 w-14 touch-manipulation rounded-xl border border-border text-red-400 hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-300 focus-visible:ring-red-400/50"
                          >
                            <Trash2 className="h-5 w-5" aria-hidden="true" />
                          </Button>
                          <p
                            id={`member-email-${index}-help`}
                            aria-live="polite"
                            className={`col-span-2 pl-1 text-xs ${
                              emailErrors[index]
                                ? "text-red-400"
                                : "text-foreground/65"
                            }`}
                          >
                            {emailErrors[index] ??
                              "Use the email address this member will use for SEAL."}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-1">
                    <Button
                      type="submit"
                      size="auto"
                      className="h-14 w-full rounded-xl bg-primary px-5 text-base font-bold text-primary-foreground shadow-lg shadow-primary/15 hover:bg-[#FF7B42] focus-visible:ring-primary/40 disabled:shadow-none sm:text-lg"
                      title={submitDisabledReason ?? undefined}
                      disabled={
                        isRegistrationBlocked ||
                        registerMutation.isPending ||
                        Boolean(submitDisabledReason)
                      }
                    >
                      {registrationBlockReason
                        ? "Registration Closed"
                        : registerMutation.isPending
                          ? "Registering…"
                          : "Submit Registration"}
                    </Button>
                    {submitDisabledReason && !registerMutation.isPending && (
                      <p
                        className="mt-2 text-center text-xs text-foreground/70"
                        aria-live="polite"
                      >
                        {submitDisabledReason}
                      </p>
                    )}
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
