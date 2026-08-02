"use client";

import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { enqueueSnackbar } from "notistack";
import { Clock, Loader2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RegistrationDeadlineBannerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any;
  isConnected?: boolean;
}

export function getFormattedTimeLeft(deadlineDate: Date | string | null): {
  text: string;
  isExpired: boolean;
} {
  if (!deadlineDate) return { text: "Not set", isExpired: true };
  const target = new Date(deadlineDate).getTime();
  const diff = target - Date.now();

  if (diff <= 0) return { text: "Registration Closed", isExpired: true };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return { text: `${parts.join(" ")} left`, isExpired: false };
}

export function RegistrationDeadlineBanner({
  event,
  isConnected = true,
}: RegistrationDeadlineBannerProps) {
  const queryClient = useQueryClient();
  const [isEditingDeadline, setIsEditingDeadline] = useState(false);
  const [editDeadlineValue, setEditDeadlineValue] = useState("");
  const [timeLeft, setTimeLeft] = useState<{ text: string; isExpired: boolean }>({
    text: "",
    isExpired: false,
  });

  const registrationDeadline = event?.registrationDeadline
    ? new Date(event.registrationDeadline)
    : null;

  // Format date for datetime-local input
  const formatForDatetimeLocal = (d: Date | null) => {
    if (!d) return "";
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  useEffect(() => {
    const updateTimer = () => {
      setTimeLeft(getFormattedTimeLeft(event?.registrationDeadline));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [event?.registrationDeadline]);

  const updateDeadlineMutation = useMutation({
    mutationFn: async (deadlineStr: string) => {
      const isoDate = new Date(deadlineStr).toISOString();
      return axiosClient.patch(`/organizer/events/${event.id}/registration-deadline`, {
        registrationDeadline: isoDate,
      });
    },
    onSuccess: () => {
      enqueueSnackbar("Registration deadline updated successfully", {
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["publicEvent", String(event.id)] });
      queryClient.invalidateQueries({ queryKey: ["organizerEvent", String(event.id)] });
      queryClient.invalidateQueries({ queryKey: ["organizerTeams", event.id] });
      setIsEditingDeadline(false);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      enqueueSnackbar(
        error.response?.data?.message || "Failed to update registration deadline",
        { variant: "error" },
      );
    },
  });

  const formattedDeadlineText = registrationDeadline
    ? new Intl.DateTimeFormat("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(registrationDeadline)
    : "Not set";

  return (
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          {isConnected && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider border border-green-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Live
            </span>
          )}
        </div>

        <div className="text-muted-foreground mt-2 space-y-1">
          <p>Manage registrations and approve teams for {event?.name || "this event"}.</p>

          {isEditingDeadline ? (
            <div className="flex items-center gap-2 mt-2 bg-card p-2 rounded-xl border border-border shadow-sm w-fit">
              <input
                type="datetime-local"
                value={editDeadlineValue}
                onChange={(e) => setEditDeadlineValue(e.target.value)}
                className="bg-background border border-border text-foreground text-xs rounded-lg p-1.5 focus:ring-2 focus:ring-orange-500"
              />
              <Button
                size="sm"
                variant="orange"
                className="h-8 px-3 text-xs gap-1 font-semibold"
                onClick={() => {
                  if (!editDeadlineValue) return;
                  updateDeadlineMutation.mutate(editDeadlineValue);
                }}
                disabled={updateDeadlineMutation.isPending || !editDeadlineValue}
              >
                {updateDeadlineMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={() => setIsEditingDeadline(false)}
                disabled={updateDeadlineMutation.isPending}
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400 mt-1">
              <span>Deadline: {formattedDeadlineText}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs gap-1 border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950"
                onClick={() => {
                  setEditDeadlineValue(formatForDatetimeLocal(registrationDeadline));
                  setIsEditingDeadline(true);
                }}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Top Right Inline Time Left Pill Box */}
      <div className="flex flex-col items-end gap-3 mt-2 md:mt-0">
        <div
          className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl border ${
            timeLeft.isExpired
              ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
              : "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400"
          } font-semibold shadow-sm`}
        >
          <Clock
            className={`h-4 w-4 ${
              timeLeft.isExpired ? "text-red-500" : "text-orange-500 animate-pulse"
            }`}
          />
          <span className="font-mono text-base font-bold tracking-tight">
            {timeLeft.text}
          </span>
        </div>
      </div>
    </div>
  );
}
