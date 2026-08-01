"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  Mail,
  Users,
  XCircle,
} from "lucide-react";
import { enqueueSnackbar } from "notistack";
import { isAxiosError } from "axios";

import { axiosClient } from "@/lib/axios";
import { useAuthStore } from "@/lib/stores/auth.store";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";

type Invitation = {
  email: string;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "expired";
  expiresAt: string;
  team: {
    id: number;
    name: string;
    event: { id: number; name: string };
    track: { id: number; name: string };
    leader: { name: string };
  };
};

type Profile = {
  email?: string | null;
  role?: string | null;
  studentProfile?: unknown;
};

export default function TeamInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const invitationPath = `/team-invitations/${token}`;

  const invitationQuery = useQuery<Invitation>({
    queryKey: ["teamInvitation", token],
    queryFn: async () => {
      const response = await axiosClient.get(
        `/public/team-invitations/${token}`,
      );
      return response.data.data;
    },
    enabled: Boolean(token),
    retry: false,
  });

  const profileQuery = useQuery<Profile>({
    queryKey: queryKeys.user,
    queryFn: async () => {
      const response = await axiosClient.get("/users/profile");
      return response.data.data;
    },
    enabled: Boolean(accessToken),
    retry: false,
  });

  const respondMutation = useMutation({
    mutationFn: async (accept: boolean) => {
      const action = accept ? "accept" : "reject";
      return axiosClient.post(
        `/student/teams/invitation-tokens/${token}/${action}`,
      );
    },
    onSuccess: (_response, accept) => {
      queryClient.invalidateQueries({ queryKey: ["teamInvitation", token] });
      queryClient.invalidateQueries({ queryKey: ["pendingInvitations"] });
      enqueueSnackbar(
        accept ? "Invitation accepted!" : "Invitation rejected.",
        {
          variant: accept ? "success" : "info",
        },
      );
      if (accept && invitationQuery.data) {
        router.push(
          `/student/events/${invitationQuery.data.team.event.id}/workspace/my-team`,
        );
      }
    },
    onError: (error: unknown) => {
      const message = isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      enqueueSnackbar(message || "Unable to process this invitation.", {
        variant: "error",
      });
    },
  });

  if (invitationQuery.isLoading) {
    return (
      <InvitationShell>
        <Loader2 className="size-9 animate-spin text-orange-500" />
      </InvitationShell>
    );
  }

  if (invitationQuery.isError || !invitationQuery.data) {
    return (
      <InvitationShell>
        <StatusMessage
          title="Invitation unavailable"
          message="This invitation link is invalid or no longer available."
        />
      </InvitationShell>
    );
  }

  const invitation = invitationQuery.data;
  const normalizedProfileEmail = profileQuery.data?.email?.trim().toLowerCase();
  const emailMatches = normalizedProfileEmail === invitation.email;

  return (
    <InvitationShell>
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
          <Mail className="size-6" />
        </div>
        <p className="text-sm font-semibold text-orange-500">TEAM INVITATION</p>
        <h1 className="mt-2 text-3xl font-bold">Join {invitation.team.name}</h1>
        <p className="mt-3 text-muted-foreground">
          {invitation.team.leader.name} invited {invitation.email} to join this
          team.
        </p>

        <div className="my-6 space-y-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <p className="flex items-center gap-2">
            <CalendarDays className="size-4 text-orange-500" />
            {invitation.team.event.name}
          </p>
          <p className="flex items-center gap-2">
            <Users className="size-4 text-orange-500" />
            Track: {invitation.team.track.name}
          </p>
        </div>

        {invitation.status !== "pending" ? (
          <StatusMessage
            title={`Invitation ${invitation.status}`}
            message="This invitation can no longer be processed."
          />
        ) : !accessToken ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign in or create an account with the invited email to continue.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="flex-1">
                <Link
                  href={`/login?redirect=${encodeURIComponent(invitationPath)}`}
                >
                  Sign in
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link
                  href={`/register?email=${encodeURIComponent(invitation.email)}&redirect=${encodeURIComponent(invitationPath)}`}
                >
                  Create account
                </Link>
              </Button>
            </div>
          </div>
        ) : profileQuery.isLoading ? (
          <Loader2 className="mx-auto size-7 animate-spin text-orange-500" />
        ) : !emailMatches ? (
          <StatusMessage
            title="Different account"
            message={`Sign in with ${invitation.email} to respond to this invitation.`}
          />
        ) : profileQuery.data?.role !== "student" ? (
          <StatusMessage
            title="Student account required"
            message="Only student accounts can join event teams."
          />
        ) : !profileQuery.data?.studentProfile ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Complete your student profile before accepting the invitation.
            </p>
            <Button asChild className="w-full">
              <Link
                href={`/student/profile?redirect=${encodeURIComponent(invitationPath)}`}
              >
                Complete profile
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={respondMutation.isPending}
              onClick={() => respondMutation.mutate(true)}
            >
              <CheckCircle2 className="size-4" /> Accept invitation
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-red-500/30 text-red-500"
              disabled={respondMutation.isPending}
              onClick={() => respondMutation.mutate(false)}
            >
              <XCircle className="size-4" /> Reject
            </Button>
          </div>
        )}
      </div>
    </InvitationShell>
  );
}

function InvitationShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-4 py-12 text-foreground">
      {children}
    </main>
  );
}

function StatusMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
