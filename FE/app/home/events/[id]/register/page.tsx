"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { enqueueSnackbar } from "notistack";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth.store";
import {
  ensureRequiredEmailSlots,
  normalizeTeamMemberEmail,
  validateTeamMemberEmails,
} from "@/lib/team-registration-validation";

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
  tracks?: EventTrack[];
}

interface EventTrack {
  id: number;
  name: string;
}

interface TeamMember {
  role?: string | null;
  user?: {
    email?: string | null;
  } | null;
}

interface RegisterPayload {
  trackId: number;
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

  return null;
}

export default function EventRegistrationPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const currentUserEmail = useAuthStore((state) => state.user?.email ?? "");

  const [teamName, setTeamName] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<number | null>(null);
  const [memberEmails, setMemberEmails] = useState<string[]>([""]);

  // Fetch Event Details to get Tracks
  const { data: event, isLoading: isEventLoading } = useQuery({
    queryKey: ["publicEvent", eventId],
    queryFn: async () => {
      const res = await axiosClient.get(`/public/events/${eventId}`);
      return res.data.data as PublicEvent;
    },
  });

  // Fetch Student Registration Status
  const { data: studentInfo, isLoading: isStudentLoading } = useQuery({
    queryKey: ["studentEventStatus", eventId],
    queryFn: async () => {
      const res = await axiosClient.get(`/student/teams/status/${eventId}`);
      return res.data.data;
    },
  });

  const teamStatus = studentInfo?.teamInfo?.team?.status;
  const isEditing =
    !!studentInfo?.teamInfo &&
    teamStatus !== "rejected" &&
    teamStatus !== "disqualified";

  // Pre-fill form if editing or re-registering after elimination
  useEffect(() => {
    if (studentInfo?.teamInfo?.team) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTeamName(studentInfo.teamInfo.team.name);

      setSelectedTrack(studentInfo.teamInfo.team.trackId);

      // Pre-fill member emails (excluding the current user / leader)
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
    }
  }, [studentInfo, event?.minMembersPerTeam, event?.maxMembersPerTeam]);

  const queryClient = useQueryClient();

  const registrationBlockReason = getRegistrationBlockReason(event, isEditing);
  const isRegistrationBlocked = Boolean(registrationBlockReason);
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
    const frame = requestAnimationFrame(() => {
      setMemberEmails((previous) =>
        ensureRequiredEmailSlots(
          previous,
          minMembersPerTeam,
          maxMembersPerTeam,
        ),
      );
    });
    if (memberEmails.length > maxAdditionalMembers) {
      enqueueSnackbar(
        `The member list has been shortened to fit the event limit (${maxMembersPerTeam} members).`,
        { variant: "info" },
      );
    }
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minMembersPerTeam, maxMembersPerTeam]);

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterPayload) => {
      const blockReason = getRegistrationBlockReason(event, isEditing);
      if (blockReason) {
        throw new Error(blockReason);
      }

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
      router.push(`/home/events/${eventId}`);
    },
    onError: (error: unknown) => {
      const apiError = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const message =
        apiError.response?.data?.message ||
        apiError.message ||
        "Registration failed";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const isLoading = isEventLoading || isStudentLoading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const blockReason = getRegistrationBlockReason(event, isEditing);
    if (blockReason) {
      enqueueSnackbar(blockReason, { variant: "warning" });
      return;
    }

    if (!selectedTrack) {
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
      trackId: selectedTrack,
      teamName,
      memberEmails: validEmails,
    });
  };

  const addEmailField = () => {
    if (isRegistrationBlocked) {
      enqueueSnackbar(registrationBlockReason, { variant: "warning" });
      return;
    }

    if (!selectedTrack) {
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
    const newEmails = [...memberEmails];
    newEmails.splice(index, 1);
    setMemberEmails(newEmails);
  };
  const updateEmail = (index: number, value: string) => {
    const newEmails = [...memberEmails];
    newEmails[index] = value;
    setMemberEmails(newEmails);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex justify-center items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl">
        <Link
          href={`/home/events/${eventId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Event Details
        </Link>

        <div className="bg-card border border-border rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-orange-500/10 blur-[80px]" />

          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-black text-foreground mb-2">
              Team Registration
            </h1>
            <p className="text-muted-foreground mb-8">
              Register your team for <strong>{event.name}</strong>
            </p>

            {event.maxTeams != null && (
              <div className="mb-6 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
                <p className="font-semibold text-foreground">
                  Team capacity: {event.registeredTeams ?? 0}/{event.maxTeams}
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
                Each team must have {minMembersPerTeam}–{maxMembersPerTeam}{" "}
                members, including the leader.
              </p>
            </div>

            {registrationBlockReason && (
              <div className="mb-8 flex items-start gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
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

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Track Selection */}
              <div className="space-y-4">
                <label className="text-sm font-semibold text-foreground">
                  Select Competition Track *
                </label>
                <div className="grid sm:grid-cols-2 gap-4">
                  {event.tracks?.map((track) => (
                    <div
                      key={track.id}
                      onClick={() => {
                        if (!isRegistrationBlocked) setSelectedTrack(track.id);
                      }}
                      className={`p-4 rounded-xl border transition-all ${
                        isRegistrationBlocked
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer"
                      } ${
                        selectedTrack === track.id
                          ? "border-orange-500 bg-orange-500/10 ring-1 ring-orange-500"
                          : "border-border bg-muted/50 hover:border-orange-500/50"
                      }`}
                    >
                      <div className="font-semibold text-foreground mb-1">
                        {track.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Event team policy: {minMembersPerTeam}–
                        {maxMembersPerTeam} members
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team Name */}
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
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {/* Member Emails */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
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
                      !selectedTrack ||
                      memberEmails.length >= maxAdditionalMembers
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Member
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
                        onChange={(e) => updateEmail(index, e.target.value)}
                        disabled={isRegistrationBlocked}
                        placeholder={`Member ${index + 1} Email`}
                        aria-invalid={Boolean(emailErrors[index])}
                        className={`flex-1 bg-background border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
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
                          isRegistrationBlocked || index < requiredEmailSlots
                        }
                        className="text-red-400 hover:text-red-500 hover:bg-red-400/10 rounded-xl"
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

              {/* Submit */}
              <div className="pt-6">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white shadow-xl shadow-orange-500/20"
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
          </div>
        </div>
      </main>
    </div>
  );
}
