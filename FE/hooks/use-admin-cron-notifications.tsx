"use client";

import { useEffect } from "react";
import { useSnackbar } from "notistack";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAdminSocket } from "@/hooks/use-admin-socket";
import { Button } from "@/components/ui/button";

export function useAdminCronNotifications() {
  const { socket } = useAdminSocket();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    if (!socket) return;

    const handleReminder15m = (data: {
      eventName?: string;
      roundName?: string;
      minutesLeft?: number;
    }) => {
      queryClient.refetchQueries({ type: "active" });
      router.refresh();
      enqueueSnackbar(
        `🚨 Bulk Reminder Triggered! Round "${data.roundName || 'Active Round'}" in "${data.eventName || 'Event'}" deadline is in ~${data.minutesLeft || 15} minutes. Automated reminders sent to all competing teams.`,
        {
          variant: "warning",
          persist: true,
          action: (key) => (
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 font-bold"
              onClick={() => closeSnackbar(key)}
            >
              ✕ Close
            </Button>
          ),
        }
      );
    };

    const handleReposFrozen = (data: {
      eventName?: string;
      roundName?: string;
    }) => {
      queryClient.refetchQueries({ type: "active" });
      router.refresh();
      enqueueSnackbar(
        `🔒 Repositories Frozen! Submission deadline for Round "${data.roundName || 'Active Round'}" in "${data.eventName || 'Event'}" has expired. All GitHub repositories are now locked.`,
        {
          variant: "error",
          persist: true,
          action: (key) => (
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 font-bold"
              onClick={() => closeSnackbar(key)}
            >
              ✕ Close
            </Button>
          ),
        }
      );
    };

    const handleJobFailed = (data: {
      queueName?: string;
      error?: string;
      to?: string;
      username?: string;
    }) => {
      enqueueSnackbar(
        `⚠️ Worker Alert [${data.queueName || 'Queue'}]: Task failed for ${data.to || data.username || 'item'}. Reason: ${data.error || 'Unknown error'}`,
        {
          variant: "warning",
          persist: true,
          action: (key) => (
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 font-bold"
              onClick={() => closeSnackbar(key)}
            >
              ✕ Dismiss
            </Button>
          ),
        }
      );
    };

    socket.on("round.reminder_15m_triggered", handleReminder15m);
    socket.on("round.repos_frozen", handleReposFrozen);
    socket.on("job.failed", handleJobFailed);

    return () => {
      socket.off("round.reminder_15m_triggered", handleReminder15m);
      socket.off("round.repos_frozen", handleReposFrozen);
      socket.off("job.failed", handleJobFailed);
    };
  }, [socket, enqueueSnackbar, closeSnackbar, queryClient, router]);
}
