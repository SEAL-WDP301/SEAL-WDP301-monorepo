"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ExternalLink, Send, BellRing, ChevronLeft, ChevronRight, CheckCircle2, Clock, Users, Pencil, Check, X } from "lucide-react";
import Link from "next/link";
import { useAdminSocket } from "@/hooks/use-admin-socket";
import { useAdminRealtimeSse } from "@/lib/hooks/useAdminRealtimeSse";
// removed duplicate React imports
import { enqueueSnackbar } from "notistack";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FaGithub, FaSnowflake } from "react-icons/fa";
import {
  GithubCommitCard,
  GithubSummaryBar,
  normalizeGithubCommitsPayload,
  type GithubCommitSummary,
  type GithubRepoInsights,
} from "@/components/github/github-activity-stats";
import { TeamGithubAnalyticsDialog } from "@/components/github/team-github-analytics-dialog";
import { EventGithubDashboard } from "@/components/github/event-github-dashboard";

function formatForDatetimeLocal(dateInput?: string | Date | null) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function EventSubmissionsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const eventId = params.id as string;
  const roundId = params.roundId as string;

  // Real-time SSE stream subscription for project submissions & round status (100% SSE / Redis PubSub)
  useAdminRealtimeSse({
    eventId: Number(eventId),
    roundId: Number(roundId),
    onRoundUpdate: (payload) => {
      if (payload.type === "submission.created") {
        const teamName = payload.data?.teamName || "A team";
        enqueueSnackbar(`📁 New submission from team: ${teamName}`, { variant: "info" });
        queryClient.invalidateQueries({ queryKey: ["organizerSubmissions", eventId] });
      }
    },
  });
  
  const defaultTab = searchParams.get("tab") === "activitylog" ? "activity" : "submissions";
  const [selectedTrackId, setSelectedTrackId] = useState<number | "">("");
  const [submissionFilter, setSubmissionFilter] = useState<"all" | "submitted" | "unsubmitted">("all");
  const [page, setPage] = useState(1);
  const [isBulkReminderOpen, setIsBulkReminderOpen] = useState(false);
  const [isFreezeModalOpen, setIsFreezeModalOpen] = useState(false);
  const [isUnfreezeModalOpen, setIsUnfreezeModalOpen] = useState(false);
  const [selectedTeamForStatus, setSelectedTeamForStatus] = useState<number | null>(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [selectedTeamFilterForLogs, setSelectedTeamFilterForLogs] = useState<string>("all");
  const [analyticsTeam, setAnalyticsTeam] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const PAGE_SIZE = 10;
  const queryClient = useQueryClient();

  // Fetch event to get tracks and rounds for filters
  const { data: event } = useQuery({
    queryKey: ["organizerEvent", eventId],
    queryFn: async () => {
      const res = await axiosClient.get(`/public/events/${eventId}`);
      return res.data.data;
    },
  });

  // Fetch Submissions
  const { data: submissions, isLoading } = useQuery({
    queryKey: ["organizerSubmissions", eventId, selectedTrackId, roundId],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (selectedTrackId) queryParams.append("trackId", selectedTrackId.toString());
      if (roundId) queryParams.append("roundId", roundId);
      const res = await axiosClient.get(`/organizer/events/${eventId}/submissions?${queryParams.toString()}`);
      return res.data.data;
    },
  });

  const currentRound = event?.rounds?.find((r: any) => r.id === Number(roundId));
  const isGithubRound = currentRound?.submissionType === "github_link";

  const { data: eventCommits } = useQuery({
    queryKey: ["eventCommits", eventId],
    queryFn: async () => {
      const res = await axiosClient.get(`/github/commits/event/${eventId}`);
      return res.data;
    },
    enabled: isGithubRound,
  });

  const { commits: eventCommitsList, summary: eventCommitSummary } =
    normalizeGithubCommitsPayload(eventCommits);

  const selectedInsightsTeamId =
    selectedTeamFilterForLogs !== "all"
      ? Number(selectedTeamFilterForLogs)
      : null;

  const { data: selectedTeamInsights } = useQuery({
    queryKey: ["githubRepoInsights", selectedInsightsTeamId],
    queryFn: async () => {
      const res = await axiosClient.get(
        `/github/repos/${selectedInsightsTeamId}/insights`,
      );
      return (res.data?.data || null) as {
        insights?: GithubRepoInsights | null;
        commitSummary?: GithubCommitSummary | null;
      } | null;
    },
    enabled: isGithubRound && !!selectedInsightsTeamId,
    staleTime: 60_000,
  });

  const { data: collabStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ["collabStatus", selectedTeamForStatus],
    queryFn: async () => {
      const res = await axiosClient.get(`/github/repos/${selectedTeamForStatus}/collaborator-status`);
      return res.data.data;
    },
    enabled: !!selectedTeamForStatus && isStatusOpen,
  });

  const freezeAllMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosClient.post(`/github/repos/freeze-event/${eventId}`);
      return res.data;
    },
    onSuccess: (data) => {
      enqueueSnackbar(data.message || "Repositories frozen successfully", { variant: "success" });
      setIsFreezeModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["organizerSubmissions", eventId] });
      queryClient.invalidateQueries({ queryKey: ["organizerEvent", eventId] });
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || "Failed to freeze repositories", { variant: "error" });
    }
  });

  const unfreezeAllMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosClient.post(`/github/repos/unfreeze-event/${eventId}`);
      return res.data;
    },
    onSuccess: (data) => {
      enqueueSnackbar(data.message || "Repositories unfrozen successfully", { variant: "success" });
      setIsUnfreezeModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["organizerSubmissions", eventId] });
      queryClient.invalidateQueries({ queryKey: ["organizerEvent", eventId] });
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || "Failed to unfreeze repositories", { variant: "error" });
    }
  });

  const [syncingTeamId, setSyncingTeamId] = useState<number | null>(null);

  const syncCommitsMutation = useMutation({
    mutationFn: async (teamId: number) => {
      setSyncingTeamId(teamId);
      const res = await axiosClient.post(`/github/repos/sync/${teamId}`);
      return res.data?.data || res.data;
    },
    onSuccess: (data) => {
      enqueueSnackbar(data.message || "Synced selected team only", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["eventCommits", eventId] });
      queryClient.invalidateQueries({ queryKey: ["eventGithubDashboard", eventId] });
      if (data?.teamId) {
        queryClient.invalidateQueries({ queryKey: ["githubTeamAnalytics", data.teamId] });
        queryClient.invalidateQueries({ queryKey: ["teamRepoInsights", data.teamId] });
      }
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || "Failed to sync team commits", { variant: "error" });
    },
    onSettled: () => setSyncingTeamId(null),
  });

  const { socket, isConnected } = useAdminSocket({ eventId, roundId });

  useEffect(() => {
    if (!socket) return;

    const handleNewCommit = (data: any) => {
      enqueueSnackbar(
        `🚀 [${data.teamName}] ${data.pusher} vừa commit: "${data.message}"`, 
        { variant: 'info' }
      );
      
      // Update cache instantly
      const updateFn = (oldData: any) => {
        const { commits: currentList, summary } =
          normalizeGithubCommitsPayload(oldData);
        const newCommit = {
          id: data.commitHash || Date.now(),
          teamId: data.teamId,
          team: { name: data.teamName },
          commitHash: data.commitHash || data.commitUrl?.split("/").pop(),
          message: data.message,
          pusher: data.pusher,
          url: data.commitUrl,
          timestamp: data.timestamp || new Date().toISOString(),
          additions: data.additions ?? null,
          deletions: data.deletions ?? null,
          changedFiles: data.changedFiles ?? null,
          files: data.files ?? null,
          authorLogin: data.authorLogin ?? null,
        };
        return {
          success: true,
          data: {
            commits: [newCommit, ...currentList],
            summary,
          },
        };
      };

      // Try both string and number just in case
      queryClient.setQueryData(["eventCommits", eventId], updateFn);
      queryClient.setQueryData(["eventCommits", Number(eventId)], updateFn);
      
      // Also invalidate fuzzy match (any query starting with eventCommits)
      queryClient.invalidateQueries({ queryKey: ["eventCommits"] });
    };

    socket.on('github.commit.new', handleNewCommit);

    return () => {
      socket.off('github.commit.new', handleNewCommit);
    };
  }, [socket, queryClient, eventId]);

  // Bulk Reminder Mutation
  const bulkRemindMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosClient.post(`/organizer/submissions/events/${eventId}/rounds/${roundId}/bulk-remind`);
      return res.data;
    },
    onSuccess: (data) => {
      enqueueSnackbar(`Successfully sent reminders to ${data.data?.unsubmittedCount + data.data?.submittedCount} teams!`, { variant: "success" });
      setIsBulkReminderOpen(false);
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || "Failed to send bulk reminders", { variant: "error" });
      setIsBulkReminderOpen(false);
    },
  });

  const [isEditingDeadline, setIsEditingDeadline] = useState(false);
  const [editDeadlineValue, setEditDeadlineValue] = useState("");

  const updateDeadlineMutation = useMutation({
    mutationFn: async (newDeadline: string) => {
      const res = await axiosClient.patch(
        `/organizer/events/${eventId}/rounds/${roundId}/deadline`,
        { submissionDeadline: new Date(newDeadline).toISOString() }
      );
      return res.data;
    },
    onSuccess: (data, newDeadlineStr) => {
      enqueueSnackbar(data.message || "Cập nhật deadline thành công!", { variant: "success" });
      const isoDeadline = new Date(newDeadlineStr).toISOString();
      queryClient.setQueryData(["organizerEvent", eventId], (oldData: any) => {
        if (!oldData || !oldData.rounds) return oldData;
        return {
          ...oldData,
          rounds: oldData.rounds.map((r: any) =>
            r.id === Number(roundId) ? { ...r, submissionDeadline: isoDeadline } : r
          ),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["organizerEvent", eventId] });
      queryClient.invalidateQueries({ queryKey: ["organizerSubmissions", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      setIsEditingDeadline(false);
    },
    onError: (error: any) => {
      enqueueSnackbar(
        error.response?.data?.message || "Lỗi khi cập nhật deadline",
        { variant: "error" }
      );
    },
  });

  const filteredSubmissions = submissions?.filter((sub: any) => {
    if (submissionFilter === "submitted") return sub.isSubmittedStatus === true;
    if (submissionFilter === "unsubmitted") return sub.isSubmittedStatus === false;
    return true;
  }) || [];

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedTrackId, submissionFilter]);

  const totalRows = filteredSubmissions.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const paginatedSubmissions = filteredSubmissions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const [timeRemaining, setTimeRemaining] = useState<{text: string, isExpired: boolean} | null>(null);

  useEffect(() => {
    if (!currentRound?.submissionDeadline) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const diff = new Date(currentRound.submissionDeadline).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeRemaining({ text: "Time's up", isExpired: true });
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);

      setTimeRemaining({ text: `${parts.join(" ")} left`, isExpired: false });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentRound?.submissionDeadline]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Submissions</h1>
            {isConnected && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Live
              </span>
            )}
          </div>
          <div className="text-muted-foreground mt-2 space-y-1">
            <p>Review team submissions across all active rounds.</p>
            {isEditingDeadline ? (
              (() => {
                const isPastDeadline = editDeadlineValue ? new Date(editDeadlineValue).getTime() <= Date.now() : false;
                return (
                  <div className="flex flex-col gap-1 mt-2">
                    <div className="flex flex-wrap items-center gap-2 bg-muted/40 p-2 rounded-xl border border-border">
                      <input
                        type="datetime-local"
                        value={editDeadlineValue}
                        min={formatForDatetimeLocal(new Date())}
                        onChange={(e) => setEditDeadlineValue(e.target.value)}
                        className="bg-background border border-border text-foreground text-xs rounded-lg p-1.5 focus:ring-2 focus:ring-blue-500"
                      />
                      <Button
                        size="sm"
                        variant="orange"
                        className="h-8 px-3 text-xs gap-1 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => {
                          if (!editDeadlineValue) return;
                          if (isPastDeadline) {
                            enqueueSnackbar("Deadline must be set in the future.", { variant: "warning" });
                            return;
                          }
                          updateDeadlineMutation.mutate(editDeadlineValue);
                        }}
                        disabled={updateDeadlineMutation.isPending || isPastDeadline || !editDeadlineValue}
                      >
                        {updateDeadlineMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
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
                    {isPastDeadline && (
                      <p className="text-xs text-red-500 font-medium animate-pulse ml-1">
                        ⚠️ Deadline must be set in the future.
                      </p>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="flex items-center gap-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 mt-1">
                <span>
                  Deadline: {currentRound?.submissionDeadline ? new Date(currentRound.submissionDeadline).toLocaleString() : "Not set"}
                </span>
                {(() => {
                  const isOpen = currentRound?.status === "open";
                  return (
                    <div title={!isOpen ? "Editing deadline is only allowed when round status is open." : ""}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs gap-1 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={!isOpen}
                        onClick={() => {
                          setEditDeadlineValue(formatForDatetimeLocal(currentRound?.submissionDeadline));
                          setIsEditingDeadline(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3 mt-4 md:mt-0">
          <Button variant="outline" className="gap-2 border-blue-500/20 text-blue-600 hover:bg-blue-50 w-full md:w-auto">
            <Download className="h-4 w-4" />
            Export All
          </Button>
          {timeRemaining && (
            <div
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl border ${
                timeRemaining.isExpired
                  ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                  : "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400"
              } font-semibold shadow-sm`}
            >
              <Clock
                className={`h-4 w-4 ${
                  timeRemaining.isExpired ? "text-red-500" : "text-orange-500 animate-pulse"
                }`}
              />
              <span className="font-mono text-base font-bold tracking-tight">
                {timeRemaining.text}
              </span>
            </div>
          )}
        </div>
      </div>
      <Tabs 
        value={defaultTab}
        onValueChange={(val) => {
          const newParams = new URLSearchParams(searchParams.toString());
          if (val === "activity") {
            newParams.set("tab", "activitylog");
          } else {
            newParams.delete("tab");
          }
          router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
        }}
      >
        {isGithubRound && (
          <TabsList className="mb-6 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="submissions" className="rounded-lg px-6">Submissions</TabsTrigger>
            <TabsTrigger value="activity" className="rounded-lg px-6">Repo Dashboard</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="submissions" className="mt-0">
          <GlassCard className="p-6 rounded-[24px]">
        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={selectedTrackId}
              onChange={(e) => {
                setSelectedTrackId(e.target.value ? Number(e.target.value) : "");
              }}
              className="bg-background border border-border text-foreground text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 min-w-[150px]"
            >
              <option value="">All Tracks</option>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {event?.tracks?.map((track: any) => (
                <option key={track.id} value={track.id}>{track.name}</option>
              ))}
            </select>
            <select
              value={submissionFilter}
              onChange={(e) => {
                setSubmissionFilter(e.target.value as "all" | "submitted" | "unsubmitted");
              }}
              className="bg-background border border-border text-foreground text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 min-w-[150px]"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="unsubmitted">Unsubmitted</option>
            </select>
            <div className="text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border">
              Total: <span className="font-bold text-foreground">{totalRows}</span> rows
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isGithubRound && (
              currentRound?.isRepoFrozen ? (
                <Button 
                  variant="outline" 
                  className="gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                  onClick={() => setIsUnfreezeModalOpen(true)}
                  disabled={unfreezeAllMutation.isPending}
                >
                  {unfreezeAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Unfreeze Repositories
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  className="gap-2 border-cyan-500/30 text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950"
                  onClick={() => setIsFreezeModalOpen(true)}
                  disabled={freezeAllMutation.isPending}
                >
                  <FaSnowflake className="h-4 w-4" />
                  Freeze Repositories
                </Button>
              )
            )}
            {(() => {
              const isRoundInactive = 
                currentRound?.status === "closed" || 
                currentRound?.status === "published_results" || 
                currentRound?.status === "published" ||
                currentRound?.isRepoFrozen === true;

              return (
                <div title={isRoundInactive ? "Bulk reminder is disabled for closed or published rounds." : ""}>
                  <Button 
                    variant="orange" 
                    className="gap-2 shadow-[0_0_15px_rgba(243,112,33,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setIsBulkReminderOpen(true)}
                    disabled={isRoundInactive}
                  >
                    <BellRing className="h-4 w-4" />
                    Bulk Reminder
                  </Button>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-semibold w-16">#</th>
                <th className="px-6 py-4 font-semibold">Team Name</th>
                <th className="px-6 py-4 font-semibold">Track & Round</th>
                <th className="px-6 py-4 font-semibold">Submitted By</th>
                <th className="px-6 py-4 font-semibold">Links & Status</th>
                <th className="px-6 py-4 font-semibold">Time</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                  </td>
                </tr>
              ) : paginatedSubmissions.length > 0 ? (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                paginatedSubmissions.map((sub: any, idx: number) => (
                  <tr key={sub.id} className="border-b border-border hover:bg-muted/10">
                    <td className="px-6 py-4 font-medium text-muted-foreground">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-foreground">{sub.team?.name}</span>
                        {isGithubRound && (sub.team?.githubRepoUrl || sub.githubUrl) && (
                          <div className="pt-0.5">
                            {currentRound?.isRepoFrozen ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 border border-cyan-500/30 dark:text-cyan-400">
                                <FaSnowflake className="h-2.5 w-2.5" /> Frozen (Read-Only)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 dark:text-emerald-400">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Active (Write Access)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs">
                        <div className="font-semibold">{sub.team?.track?.name}</div>
                        <div className="text-muted-foreground">{sub.round?.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {sub.isSubmittedStatus ? (
                        sub.submittedBy?.name || sub.submittedBy?.email || "Team Leader"
                      ) : (
                        <span className="text-xs font-semibold text-red-500 bg-red-500/10 px-2 py-1 rounded-md">
                          Unsubmitted
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {(sub.githubUrl || sub.team?.githubRepoUrl) && (
                          <a href={sub.githubUrl || sub.team?.githubRepoUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 text-xs font-medium">
                            GitHub <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {sub.fileUrl && (
                          <a href={sub.fileUrl} target="_blank" rel="noreferrer" className="text-green-500 hover:underline flex items-center gap-1 text-xs font-medium">
                            File/Doc <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {!sub.githubUrl && !sub.team?.githubRepoUrl && !sub.fileUrl && (
                           <span className="text-xs text-muted-foreground italic">No links provided</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {sub.isSubmittedStatus ? (
                        new Date(sub.updatedAt || sub.createdAt).toLocaleString()
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isGithubRound && sub.githubUrl && (
                        <Button 
                          variant="ghost" 
                          size="icon-sm" 
                          className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 mr-2" 
                          title="Collaborator Status" 
                          onClick={() => { 
                            setSelectedTeamForStatus(sub.team.id); 
                            setIsStatusOpen(true); 
                          }}
                        >
                          <Users className="h-4 w-4" />
                          <span className="sr-only">Status</span>
                        </Button>
                      )}
                      <Link href={`/organizer/events/${eventId}/messages?teamId=${sub.team?.id}`}>
                        <Button variant="ghost" size="icon-sm" className="text-orange-500 hover:text-orange-600 hover:bg-orange-50" title="Message team">
                          <Send className="h-4 w-4" />
                          <span className="sr-only">Message</span>
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No submissions found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border mt-4 pt-4">
            <span className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{(page - 1) * PAGE_SIZE + 1}</span> to <span className="font-semibold text-foreground">{Math.min(page * PAGE_SIZE, totalRows)}</span> of <span className="font-semibold text-foreground">{totalRows}</span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Prev
              </Button>
              <div className="text-sm font-medium px-2">
                Page {page} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </GlassCard>
      </TabsContent>

      {isGithubRound && (
          <TabsContent value="activity" className="mt-0">
            <GlassCard
              glow
              className="p-0 rounded-[24px] overflow-hidden border-orange-500/25 bg-gradient-to-b from-orange-500/[0.06] via-background to-background"
            >
              <EventGithubDashboard
                eventId={eventId}
                syncingTeamId={syncingTeamId}
                onOpenTeam={(team) => setAnalyticsTeam(team)}
                onSyncTeam={(teamId) => syncCommitsMutation.mutate(teamId)}
              />
            </GlassCard>

            <TeamGithubAnalyticsDialog
              teamId={analyticsTeam?.id ?? null}
              teamName={analyticsTeam?.name}
              open={!!analyticsTeam}
              onOpenChange={(open) => {
                if (!open) setAnalyticsTeam(null);
              }}
            />
          </TabsContent>
      )}
      </Tabs>

      {/* Bulk Reminder Modal */}
      <Dialog open={isBulkReminderOpen} onOpenChange={setIsBulkReminderOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-orange-500" />
              Send Bulk Reminders
            </DialogTitle>
            <DialogDescription>
              This will send automated notifications (In-app & Email) to all teams competing in this round.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="bg-muted/50 p-4 rounded-xl space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-orange-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-foreground text-sm">For unsubmitted teams:</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    "Urgent Reminder: Submission Deadline for [Round Name]... Deadline: [Date] | Time Remaining: [X days, Y hours]... Please submit your files or code repositories before the deadline."
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 pt-2 border-t border-border">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-foreground text-sm">For submitted teams:</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    "Reminder: Review your submission for [Round Name]... The system will close at: [Date] | Time Remaining: [X days, Y hours]... We recommend that you double-check your uploaded files."
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-foreground">
              Are you sure you want to proceed?
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkReminderOpen(false)} disabled={bulkRemindMutation.isPending}>
              Cancel
            </Button>
            <Button 
              variant="orange" 
              onClick={() => bulkRemindMutation.mutate()}
              disabled={bulkRemindMutation.isPending}
            >
              {bulkRemindMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reminders"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStatusOpen} onOpenChange={setIsStatusOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Team GitHub Status
            </DialogTitle>
            <DialogDescription>
              Check if members have accepted their repository invitation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 my-2">
            {isLoadingStatus ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : collabStatus && collabStatus.length > 0 ? (
              <div className="space-y-3">
                {collabStatus.map((user: any) => (
                  <div key={user.userId} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm flex items-center gap-2">
                        {user.name} {user.isLeader && <span className="text-[10px] bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded">LEADER</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">{user.githubUsername || "No GitHub ID"}</span>
                    </div>
                    <div>
                      {user.status === 'Accepted' && <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded font-semibold">Accepted</span>}
                      {user.status === 'Pending' && <span className="text-xs bg-yellow-500/10 text-yellow-600 px-2 py-1 rounded font-semibold">Pending</span>}
                      {user.status === 'Missing' && <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded font-semibold">Missing</span>}
                      {user.status === 'Not Invited' && <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded font-semibold">Missing</span>}
                      {user.status === 'No GitHub Account Linked' && <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded font-semibold whitespace-nowrap">No GitHub ID</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground">No data available.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Freeze Repositories Confirmation Modal */}
      <Dialog open={isFreezeModalOpen} onOpenChange={setIsFreezeModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
              <FaSnowflake className="h-5 w-5" />
              Freeze All Team Repositories
            </DialogTitle>
            <DialogDescription>
              This action will revoke push access for all student team members across this round/event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="bg-cyan-500/10 border border-cyan-500/30 p-4 rounded-xl space-y-2 text-sm">
              <div className="flex items-start gap-3">
                <FaSnowflake className="h-5 w-5 text-cyan-500 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold text-foreground">What happens when frozen:</h4>
                  <ul className="list-disc list-inside text-xs text-muted-foreground mt-1 space-y-1">
                    <li>Collaborator permissions for all members are set to <strong>Read-Only (Pull)</strong>.</li>
                    <li>Students will no longer be able to push new commits or code to GitHub.</li>
                    <li>Repository commit history remains completely safe and accessible.</li>
                  </ul>
                </div>
              </div>
            </div>
            <p className="text-sm font-medium text-foreground text-center">
              Are you sure you want to FREEZE all team repositories now?
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsFreezeModalOpen(false)} disabled={freezeAllMutation.isPending}>
              Cancel
            </Button>
            <Button 
              className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2" 
              onClick={() => freezeAllMutation.mutate()}
              disabled={freezeAllMutation.isPending}
            >
              {freezeAllMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Freezing Repositories...
                </>
              ) : (
                <>
                  <FaSnowflake className="h-4 w-4" />
                  Confirm & Freeze All
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unfreeze Repositories Confirmation Modal */}
      <Dialog open={isUnfreezeModalOpen} onOpenChange={setIsUnfreezeModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              Unfreeze All Team Repositories
            </DialogTitle>
            <DialogDescription>
              This action will restore write (push) access for all student team members across this round/event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl space-y-2 text-sm">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold text-foreground">What happens when unfrozen:</h4>
                  <ul className="list-disc list-inside text-xs text-muted-foreground mt-1 space-y-1">
                    <li>Collaborator permissions for all members are restored to <strong>Write Access (Push)</strong>.</li>
                    <li>Students can push new commits and updates to GitHub.</li>
                  </ul>
                </div>
              </div>
            </div>
            <p className="text-sm font-medium text-foreground text-center">
              Are you sure you want to UNFREEZE all team repositories now?
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsUnfreezeModalOpen(false)} disabled={unfreezeAllMutation.isPending}>
              Cancel
            </Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" 
              onClick={() => unfreezeAllMutation.mutate()}
              disabled={unfreezeAllMutation.isPending}
            >
              {unfreezeAllMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Unfreezing Repositories...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm & Unfreeze All
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
