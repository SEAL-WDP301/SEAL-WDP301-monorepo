"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workspaceApi } from "@/lib/api/workspace.api";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  UploadCloud, 
  File, 
  X, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Loader2,
  Info,
  Eye,
  Star,
  UserCircle,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FaGithub } from "react-icons/fa";
import { useSnackbar } from "notistack";
import { isAxiosError } from "axios";
import { useWorkspaceAccess } from "../workspace-access";
import { useAdminSocket } from "@/hooks/use-admin-socket";
import { axiosClient } from "@/lib/axios";

interface SubmissionHistoryEntry {
  action: string;
  timestamp: string;
  userName?: string;
  fileName?: string;
}

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!targetDate) return;

    const interval = setInterval(() => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

export default function SubmissionsPage() {
  const params = useParams();
  const eventId = Number(params.id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const searchParams = useSearchParams();
  const selectedRoundId = searchParams.get("roundId") ? Number(searchParams.get("roundId")) : null;
  const { isReadOnly } = useWorkspaceAccess();

  const [file, setFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [description, setDescription] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [commitPage, setCommitPage] = useState(1);
  const COMMITS_PER_PAGE = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["workspace", eventId],
    queryFn: () => workspaceApi.getWorkspaceOverview(eventId),
  });

  const workspaceData = data?.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roundSubmissions: any[] = workspaceData?.roundSubmissions || [];
  const currentActiveRound = workspaceData?.currentActiveRound;

  // Determine if viewing a past round (read-only mode)
  const selectedRoundEntry = selectedRoundId
    ? roundSubmissions.find((rs) => rs.round.id === selectedRoundId)
    : roundSubmissions.find((rs) => rs.canSubmit);
  const isPastRound = selectedRoundEntry && selectedRoundEntry.round.id !== currentActiveRound?.id;
  const displayRound = selectedRoundEntry?.round ?? currentActiveRound;
  const pastSubmission = selectedRoundEntry?.submission ?? null;
  const pastScore = selectedRoundEntry?.teamRound?.score ?? null;

  const latestSubmission = workspaceData?.latestSubmission;
  const activeSubmission = isPastRound ? pastSubmission : (selectedRoundEntry?.submission ?? latestSubmission);
  const isLeader = workspaceData?.role === "leader";
  const teamStatus = workspaceData?.team?.status as string | undefined;
  const canSubmit = !isReadOnly && workspaceData?.canSubmit !== false && teamStatus === "approved";
  const assignedRepoUrl = workspaceData?.team?.githubRepoUrl as string | undefined;
  const submissionType = currentActiveRound?.submissionType as "file" | "github_link" | undefined;
  const isGithubRound = submissionType === "github_link";
  const isFileRound = submissionType === "file";
  const timeLeft = useCountdown(currentActiveRound?.submissionDeadline || null);

  const isDeadlinePassed = currentActiveRound?.submissionDeadline 
    ? new Date() > new Date(currentActiveRound.submissionDeadline)
    : false;

  const { data: commitsData, isLoading: isLoadingCommits, refetch: refetchCommits } = useQuery({
    queryKey: ["githubCommits", workspaceData?.team?.id],
    queryFn: async () => {
      const res = await axiosClient.get(`/github/commits/${workspaceData?.team?.id}`);
      return res.data;
    },
    enabled: (isGithubRound || !!assignedRepoUrl) && !!workspaceData?.team?.id,
  });

  const [liveCommits, setLiveCommits] = useState<any[]>([]);
  const [isSyncingCommits, setIsSyncingCommits] = useState(false);

  const totalCommits = liveCommits.length;
  const totalCommitPages = Math.ceil(totalCommits / COMMITS_PER_PAGE) || 1;
  const paginatedCommits = liveCommits.slice((commitPage - 1) * COMMITS_PER_PAGE, commitPage * COMMITS_PER_PAGE);

  useEffect(() => {
    if (commitsData) {
      const normalized = Array.isArray(commitsData) ? commitsData : (commitsData.data || []);
      setLiveCommits(normalized);
    }
  }, [commitsData]);

  // Group judge scores
  const judgeScores = pastSubmission?.scores?.reduce((acc: any, score: any) => {
    const judgeId = score.judge.id;
    if (!acc[judgeId]) {
      acc[judgeId] = {
        judge: score.judge,
        scores: [],
      };
    }
    acc[judgeId].scores.push(score);
    return acc;
  }, {}) || {};
  const judgeList = Object.values(judgeScores) as any[];

  // GitHub Realtime Commit Listener
  const teamId = workspaceData?.team?.id;
  const { socket } = useAdminSocket({ teamId });

  useEffect(() => {
    if (!socket) return;
    
    const handleNewCommit = (data: any) => {
      enqueueSnackbar(
        `🚀 [${data.pusher || 'GitHub'}] vừa commit: "${data.message}"`, 
        { 
          variant: 'info',
        }
      );

      setLiveCommits((prev) => {
        const newCommit = {
          id: data.commitHash || Date.now(),
          commitHash: data.commitHash || data.commitUrl?.split('/').pop(),
          message: data.message,
          pusher: data.pusher,
          url: data.commitUrl,
          timestamp: data.timestamp || new Date().toISOString(),
        };
        return [newCommit, ...prev];
      });

      queryClient.invalidateQueries({ queryKey: ["githubCommits", teamId] });
    };

    socket.on('github.commit.new', handleNewCommit);

    return () => {
      socket.off('github.commit.new', handleNewCommit);
    };
  }, [socket, enqueueSnackbar, queryClient, teamId]);

  const handleSyncCommits = async () => {
    if (!teamId) return;
    try {
      setIsSyncingCommits(true);
      await axiosClient.post(`/github/repos/sync-event/${eventId}`);
      await refetchCommits();
      enqueueSnackbar("Synced team commits successfully", { variant: "success" });
    } catch (err: any) {
      enqueueSnackbar(err.response?.data?.message || "Failed to sync commits", { variant: "error" });
    } finally {
      setIsSyncingCommits(false);
    }
  };

  // Sync initial state if there's a past or current submission
  useEffect(() => {
    if (activeSubmission) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGithubUrl(activeSubmission.githubUrl || assignedRepoUrl || "");
      setDescription(activeSubmission.description || "");
    } else if (assignedRepoUrl) {
      setGithubUrl(assignedRepoUrl);
      setDescription("");
    } else {
      setDescription("");
    }
  }, [activeSubmission, assignedRepoUrl]);


  const submitMutation = useMutation({
    mutationFn: async () => {
      if (isReadOnly) throw new Error("This event has ended. The workspace is view only.");
      if (!currentActiveRound) throw new Error("No active round");
      
      const formData = new FormData();
      formData.append("eventId", String(eventId));
      formData.append("roundId", String(currentActiveRound.id));
      if (description) formData.append("description", description);
      if (isFileRound && file) formData.append("file", file);
      if (isGithubRound && assignedRepoUrl) {
        formData.append("githubUrl", assignedRepoUrl);
      }

      return workspaceApi.submitProject(formData);
    },
    onSuccess: () => {
      enqueueSnackbar("Project submitted successfully!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["workspace", eventId] });
      setFile(null); // Clear file after successful upload
    },
    onError: (error: unknown) => {
      const responseData = isAxiosError(error) ? error.response?.data : undefined;
      if (responseData?.errors && Array.isArray(responseData.errors)) {
        responseData.errors.forEach((e: string) => enqueueSnackbar(e, { variant: "error" }));
      } else {
        enqueueSnackbar(responseData?.message || "Failed to submit", { variant: "error" });
      }
    }
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const maxSize = currentActiveRound?.maxFileSizeMb || 20;
      if (droppedFile.size > maxSize * 1024 * 1024) {
        enqueueSnackbar(`File must be smaller than ${maxSize}MB`, { variant: "error" });
        return;
      }
      setFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const maxSize = currentActiveRound?.maxFileSizeMb || 20;
      if (selectedFile.size > maxSize * 1024 * 1024) {
        enqueueSnackbar(`File must be smaller than ${maxSize}MB`, { variant: "error" });
        return;
      }
      setFile(selectedFile);
    }
  };

  const canSubmitPayload =
    isGithubRound
      ? Boolean(assignedRepoUrl || latestSubmission?.githubUrl)
      : Boolean(file || latestSubmission?.fileUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      enqueueSnackbar(
        isReadOnly
          ? "This event has ended. The workspace is view only."
          : "Your team must be approved before submitting",
        { variant: "warning" }
      );
      return;
    }
    if (!canSubmitPayload) {
      enqueueSnackbar(
        isGithubRound
          ? "Your team repository is not ready yet. Wait for organizer approval."
          : "Please upload a file for this round",
        { variant: "warning" },
      );
      return;
    }
    submitMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }



  if (!currentActiveRound && !isPastRound) {
    return (
      <div className="mx-auto max-w-[1000px] flex items-center justify-center h-[50vh]">
        <GlassCard className="p-12 text-center rounded-[24px]">
          <AlertCircle className="h-12 w-12 text-zinc-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Active Round</h2>
          <p className="text-muted-foreground">There are currently no active submission rounds for your team.</p>
        </GlassCard>
      </div>
    );
  }

  // ── Past Round Read-Only View ──────────────────────────────────────────────
  if (isPastRound) {
    return (
      <div className="mx-auto max-w-[1000px] space-y-8 animate-in fade-in duration-500">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Project Submission</h1>
            <p className="text-muted-foreground mt-1">
              Viewing results for <span className="font-semibold text-foreground">{displayRound?.name}</span> — Read Only
            </p>
          </div>
          
          {pastScore !== null ? (
            <div className="flex items-center gap-4 px-6 py-3 rounded-2xl border border-orange-500/40 bg-gradient-to-r from-orange-500/10 to-transparent shadow-[0_0_20px_-5px_rgba(249,115,22,0.3)]">
              <div className="p-2 bg-orange-500/20 rounded-xl shadow-inner">
                <Star className="h-6 w-6 text-orange-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold tracking-wider uppercase text-orange-600/80 dark:text-orange-400/80">Total Score</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold bg-gradient-to-r from-orange-600 to-yellow-500 bg-clip-text text-transparent leading-none">
                    {Number(pastScore).toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground font-semibold">/ 10</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border bg-muted/30 border-border text-muted-foreground">
              <Eye className="h-5 w-5" />
              <span className="font-semibold">Past Round</span>
            </div>
          )}
        </header>

        {/* Problem Statement & Guidelines Attachment */}
        {displayRound?.problemFileUrl && (
          <GlassCard className="p-6 rounded-[24px] border-orange-500/30 bg-orange-500/5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-orange-500/20 flex items-center justify-center shrink-0">
                <FileText className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="border-orange-500/40 text-orange-500 text-[10px] uppercase tracking-wider font-bold">
                    Official Topic Attachment
                  </Badge>
                  <span className="text-xs text-muted-foreground">· Provided by Organizers</span>
                </div>
                <h3 className="font-bold text-lg text-foreground">
                  📌 {displayRound.name} Problem Statement & Guidelines
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Read and download the official prompt, rules, and technical requirements for this round.
                </p>
              </div>
            </div>
            <Button variant="orange" size="sm" asChild className="rounded-xl gap-2 shrink-0 shadow-md">
              <a href={displayRound.problemFileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" /> Download Topic File
              </a>
            </Button>
          </GlassCard>
        )}

        {/* Submitted File / Link */}
        <GlassCard className="p-6 rounded-[24px]">
          <h3 className="font-semibold text-lg mb-4 border-b border-border pb-4">Submission — {displayRound?.name}</h3>
          {pastSubmission ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Submitted</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(pastSubmission.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {pastSubmission.description && (
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Project Description</p>
                  <p className="text-sm">{pastSubmission.description}</p>
                </div>
              )}

              {pastSubmission.fileUrl && (
                <a
                  href={pastSubmission.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 w-full p-4 border border-border rounded-xl hover:bg-muted/20 transition-colors"
                >
                  <File className="h-5 w-5 text-orange-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm">Submitted File</p>
                    <p className="text-xs text-muted-foreground truncate">{pastSubmission.fileUrl}</p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 ml-auto" />
                </a>
              )}

              {pastSubmission.githubUrl && (
                <a
                  href={pastSubmission.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 w-full p-4 border border-border rounded-xl hover:bg-muted/20 transition-colors"
                >
                  <FaGithub className="h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm">GitHub Repository</p>
                    <p className="text-xs text-muted-foreground truncate">{pastSubmission.githubUrl}</p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 ml-auto" />
                </a>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">No submissions for this round.</p>
            </div>
          )}
        </GlassCard>

        {/* Score Summary */}
        {pastScore !== null && (
          <div className="space-y-4">
            {judgeList.length > 0 && (
              <GlassCard className="p-6 rounded-[24px]">
                <h3 className="font-semibold text-lg mb-4 border-b border-border pb-4">Detailed Scores from Judges</h3>
                <div className="space-y-4">
                  {judgeList.map((j: any) => {
                    const totalJudgeScore = j.scores.reduce((sum: number, s: any) => sum + Number(s.scoreValue), 0);
                    const totalMaxScore = j.scores.reduce((sum: number, s: any) => sum + Number(s.criterion.maxScore), 0);
                    
                    return (
                      <details key={j.judge.id} className="group rounded-2xl border border-border bg-muted/20 overflow-hidden open:bg-muted/40 transition-colors">
                        <summary className="flex cursor-pointer list-none items-center justify-between p-4 focus:outline-none hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-4">
                            {j.judge.avatarUrl ? (
                              <img src={j.judge.avatarUrl} alt={j.judge.name} className="w-12 h-12 rounded-full object-cover shadow-sm ring-2 ring-background" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center shadow-sm ring-2 ring-background">
                                <UserCircle className="w-7 h-7 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-foreground">{j.judge.name}</p>
                              <p className="text-sm font-semibold text-orange-500">Score: {totalJudgeScore} <span className="text-muted-foreground font-normal">/ {totalMaxScore}</span></p>
                            </div>
                          </div>
                          <div className="p-2 rounded-full bg-background/50 group-open:rotate-180 transition-transform">
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </summary>
                        
                        <div className="px-4 pb-4 pt-2 border-t border-border/50">
                          <div className="grid gap-3 mt-2">
                            {j.scores.map((s: any) => (
                              <div key={s.id} className="bg-background/80 p-4 rounded-xl border border-border/50 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <p className="font-bold text-sm text-foreground">{s.criterion.name}</p>
                                  </div>
                                  <div className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap">
                                    {Number(s.scoreValue)} / {Number(s.criterion.maxScore)}
                                  </div>
                                </div>
                                {s.comment && (
                                  <div className="flex gap-2.5 text-sm text-foreground bg-muted p-3 rounded-lg mt-3 border border-border/50">
                                    <MessageSquare className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                                    <p className="leading-relaxed">{s.comment}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </GlassCard>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 p-4 rounded-2xl flex items-start gap-3">
          <Info className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-sm">📌 Note on judge scores</h4>
            <p className="text-sm mt-1 opacity-90">
              Scores are for reference only. All decisions on advancing teams are made by the Judges and Organizing Committee based on comprehensive evaluation, not just scores.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Project Submission</h1>
          <p className="text-muted-foreground mt-1">
            Submit your work for {currentActiveRound?.name}
          </p>
        </div>
        
        {/* Countdown Badge */}
        <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border ${isDeadlinePassed ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-orange-500/10 border-orange-500/30 text-orange-500"}`}>
          <Clock className="h-5 w-5" />
          {isDeadlinePassed ? (
            <span className="font-bold tracking-wider">DEADLINE PASSED</span>
          ) : (
            <div className="font-mono font-bold text-lg tracking-wider">
              {timeLeft.days > 0 && <>{timeLeft.days}d : </>}
              {String(timeLeft.hours).padStart(2, '0')}h : {String(timeLeft.minutes).padStart(2, '0')}m : {String(timeLeft.seconds).padStart(2, '0')}s
            </div>
          )}
        </div>
      </header>

      {/* Problem Statement & Guidelines Attachment */}
      {displayRound?.problemFileUrl && (
        <GlassCard className="p-6 rounded-[24px] border-orange-500/30 bg-orange-500/5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-orange-500/20 flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="border-orange-500/40 text-orange-500 text-[10px] uppercase tracking-wider font-bold">
                  Official Topic Attachment
                </Badge>
                <span className="text-xs text-muted-foreground">· Provided by Organizers</span>
              </div>
              <h3 className="font-bold text-lg text-foreground">
                📌 {displayRound.name} Problem Statement & Guidelines
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Read and download the official prompt, rules, and technical requirements before submitting your work for this round.
              </p>
            </div>
          </div>
          <Button variant="orange" size="sm" asChild className="rounded-xl gap-2 shrink-0 shadow-md">
            <a href={displayRound.problemFileUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Download Topic File
            </a>
          </Button>
        </GlassCard>
      )}

      {/* Disclaimer */}
      {selectedRoundEntry?.round?.status === "results_published" && (
      <div className="bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 p-4 rounded-2xl flex items-start gap-3">
        <Info className="h-5 w-5 mt-0.5 shrink-0" />
        <div>
          <h4 className="font-semibold text-sm">📌 Note on judge scores</h4>
          <p className="text-sm mt-1 opacity-90">
            Judge scores are for reference only. Decisions on advancing teams are based on comprehensive evaluation by the Organizing Committee.
          </p>
        </div>
      </div>
      )}

      {/* Non-Leader Read-Only Alert */}
      {!isLeader && (
        <div className="bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 p-4 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-sm">Read-Only View</h4>
            <p className="text-sm mt-1 opacity-90">
              You are viewing this page as a Team Member. Only the Team Leader can submit or modify the project.
            </p>
          </div>
        </div>
      )}

      {!canSubmit && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-2xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-sm">Team not approved</h4>
            <p className="text-sm mt-1 opacity-90">
              Organizer must approve your team before you can submit or get the GitHub repo link.
            </p>
          </div>
        </div>
      )}

      {isGithubRound && canSubmit && !assignedRepoUrl && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-2xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-sm">No GitHub repo yet</h4>
            <p className="text-sm mt-1 opacity-90">
              Repo will be created automatically upon approval. Push your code there before submitting.
            </p>
          </div>
        </div>
      )}

      {assignedRepoUrl && isGithubRound && (
        <GlassCard className="p-6 rounded-[24px] border border-orange-500/20 bg-orange-500/5">
          <div className="flex items-start gap-3">
            <FaGithub className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <h4 className="font-semibold">Assigned Team Repository</h4>
              <p className="text-sm text-muted-foreground mt-1">
                This is your team's official repo. Push your code here, then click Submit — the system will use this link for grading.
              </p>
              <a
                href={assignedRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-orange-500 hover:underline break-all mt-2 inline-block"
              >
                {assignedRepoUrl}
              </a>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Main Form Area */}
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className={`grid gap-6 md:grid-cols-3 items-stretch`}>
          <div className="md:col-span-2 flex flex-col gap-6">
            
            {/* Dropzone */}
            {isFileRound && (
            <GlassCard className="p-8 rounded-[24px]">
              <h2 className="text-xl font-semibold mb-4">Upload File</h2>
              <div 
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                  isDragging ? "border-orange-500 bg-orange-500/5" : "border-border hover:bg-white/[0.02]"
                } ${isDeadlinePassed || !isLeader || !canSubmit ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => {
                  if (!isLeader) return;
                  fileInputRef.current?.click();
                }}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileChange}
                  accept=".pdf,.zip,.rar"
                  disabled={isReadOnly || isDeadlinePassed || !isLeader}
                />
                
                {file ? (
                  <div className="flex flex-col items-center">
                    <div className="h-16 w-16 bg-orange-500/20 text-orange-500 rounded-full flex items-center justify-center mb-4">
                      <File className="h-8 w-8" />
                    </div>
                    <p className="font-semibold text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-4 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center pointer-events-none">
                    <div className="h-16 w-16 bg-muted text-muted-foreground rounded-full flex items-center justify-center mb-4">
                      <UploadCloud className="h-8 w-8" />
                    </div>
                    <p className="font-semibold text-foreground mb-1">
                      {isLeader ? "Click or drag file to this area to upload" : "No file uploaded"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Support for a single PDF or ZIP upload. Maximum {currentActiveRound?.maxFileSizeMb || 20}MB.
                    </p>
                  </div>
                )}
              </div>
            </GlassCard>
            )}

            <GlassCard className={`p-8 rounded-[24px] ${!isGithubRound ? 'space-y-6' : 'flex-1 flex flex-col justify-center'}`}>
              {isGithubRound && (
              <div className="flex flex-col gap-6">
                <label className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FaGithub className="h-4 w-4" />
                  Team GitHub Repository
                </label>
                <Input
                  placeholder="Repo will appear after team approval"
                  className="bg-background border-border h-12"
                  value={assignedRepoUrl || githubUrl || ""}
                  readOnly
                  disabled
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Repo link assigned to team — do not enter URL manually.
                </p>
              </div>
              )}

              {!isGithubRound && (
              <div>
                <label className="text-sm font-semibold mb-2 block">
                  Project Description / Notes
                </label>
                <Textarea 
                  placeholder={isLeader ? "Briefly describe your project or add any notes for the judges..." : "No description provided"} 
                  className="bg-background border-border min-h-[120px] resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isReadOnly || isDeadlinePassed || !isLeader}
                />
              </div>
              )}
            </GlassCard>
          </div>

          {/* Sidebar Info */}
          <div className="md:col-span-1 flex flex-col gap-6">
          <GlassCard className={`p-6 rounded-[24px] ${isGithubRound ? 'flex-1 flex flex-col justify-center' : ''}`}>
            <h3 className="font-semibold mb-4 text-lg border-b border-border pb-4">Current Submission</h3>
            {activeSubmission ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="pb-4">
                    <p className="font-medium">Submitted</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activeSubmission.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                {activeSubmission.fileUrl && (
                  <Button variant="outline" className="w-full justify-start h-12 text-[15px] font-medium" asChild>
                    <a href={activeSubmission.fileUrl} target="_blank" rel="noreferrer">
                      <File className="h-5 w-5 mr-2 text-orange-500" />
                      View Uploaded File
                    </a>
                  </Button>
                )}

                {activeSubmission.githubUrl && (
                  <Button variant="outline" className="w-full justify-start h-12 text-[15px] font-medium" asChild>
                    <a href={activeSubmission.githubUrl} target="_blank" rel="noreferrer">
                      <FaGithub className="h-5 w-5 mr-2" />
                      View Repository
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">No active submission found for this round.</p>
              </div>
            )}
          </GlassCard>

          {/* Audit History (for File Rounds) */}
          {!isGithubRound && (
          <GlassCard className="p-6 rounded-[24px]">
            <h3 className="font-semibold mb-4 text-lg border-b border-border pb-4">Audit History</h3>
            {activeSubmission?.history && Array.isArray(activeSubmission.history) && activeSubmission.history.length > 0 ? (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                <div className="relative border-l-2 border-border/60 ml-2 pl-5 space-y-6 py-2">
                  {(activeSubmission.history as SubmissionHistoryEntry[]).slice().reverse().slice(0, 5).map((log, index) => {
                    const isLatest = index === 0;
                    return (
                      <div key={index} className="relative flex gap-4 text-sm">
                        {/* Timeline Dot */}
                        <div className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-background ${isLatest ? "bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.15)]" : "bg-muted-foreground/30"}`} />
                        
                        <div className={`flex-1 ${isLatest ? "opacity-100" : "opacity-60 hover:opacity-100 transition-opacity duration-300"}`}>
                          <p className={`font-semibold ${isLatest ? "text-orange-500" : "text-foreground/80"}`}>
                            {log.action === "created" ? "Initial Submission" : "File Overwritten"}
                            {isLatest && <span className="ml-2 text-[10px] bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded font-medium uppercase tracking-wider">Latest</span>}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(log.timestamp).toLocaleString()} by {log.userName || "Leader"}
                          </p>
                          {log.fileName && (
                            <div className="mt-2 inline-flex items-center gap-1.5 bg-muted/50 border border-border/50 px-2 py-1 rounded-md max-w-full">
                              <File className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground truncate">{log.fileName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {activeSubmission.history.length > 5 && (
                  <Dialog>
                    <DialogTrigger render={<Button variant="outline" className="w-full mt-4" size="sm" />}>
                      View all {activeSubmission.history.length} records
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Full Audit History</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-4 mt-4">
                        {(activeSubmission.history as SubmissionHistoryEntry[]).slice().reverse().map((log, index) => (
                          <div key={index} className="flex gap-3 text-sm border-b border-border/50 pb-4 last:border-0 last:pb-0">
                            <div className="mt-1">
                              <div className={`h-2 w-2 rounded-full ${log.action === "created" ? "bg-green-500" : "bg-orange-500"}`} />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-foreground">
                                {log.action === "created" ? "Initial Submission" : "File Overwritten"}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {new Date(log.timestamp).toLocaleString()} by {log.userName || "Leader"}
                              </p>
                              {log.fileName && (
                                <p className="text-xs text-muted-foreground mt-2 bg-muted px-2 py-1 rounded-md inline-block break-all">
                                  {log.fileName}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="h-5 w-5" />
                <p className="text-sm">No history available yet.</p>
              </div>
            )}
            </GlassCard>
          )}
          </div>
        </div>

        {/* Full-width Realtime Activity Log (for Teams with GitHub Repo) */}
        {(isGithubRound || !!assignedRepoUrl) && (
          <GlassCard className="p-6 rounded-[24px] mt-6 w-full">
            <div className="flex items-center justify-between mb-4 border-b border-border pb-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FaGithub className="h-5 w-5 text-orange-500" />
                Team Realtime Activity Log (GitHub)
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 border-blue-500/20 text-blue-600 hover:bg-blue-50"
                onClick={handleSyncCommits}
                disabled={isSyncingCommits || isLoadingCommits}
              >
                {isSyncingCommits ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                Sync Missed Commits
              </Button>
            </div>
            {paginatedCommits.length > 0 ? (
              <div className="space-y-4 pr-2">
                <div className="relative border-l-2 border-border/60 ml-2 pl-5 space-y-6 py-2">
                  {paginatedCommits.map((commit, index) => {
                    const isLatest = commitPage === 1 && index === 0;
                    return (
                      <div key={commit.id || index} className="relative flex gap-4 text-sm">
                        <div className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-background ${isLatest ? "bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.15)]" : "bg-muted-foreground/30"}`} />
                        <div className="flex-1 opacity-100 transition-opacity duration-300 bg-muted/20 p-4 rounded-xl border border-border/50 hover:bg-muted/40">
                          <p className="font-semibold text-foreground/90">
                            <a href={commit.url} target="_blank" rel="noreferrer" className="hover:text-orange-500 transition-colors">
                              {commit.message}
                            </a>
                            {isLatest && <span className="ml-2 text-[10px] bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded font-medium uppercase tracking-wider border border-orange-500/20">Latest</span>}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {new Date(commit.timestamp).toLocaleString()} 
                            <span className="mx-1">•</span>
                            <span className="font-medium text-orange-500">{commit.pusher}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Pagination */}
                {totalCommitPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border mt-6 pt-4">
                    <span className="text-sm text-muted-foreground">
                      Showing <span className="font-semibold text-foreground">{(commitPage - 1) * COMMITS_PER_PAGE + 1}</span> to <span className="font-semibold text-foreground">{Math.min(commitPage * COMMITS_PER_PAGE, totalCommits)}</span> of <span className="font-semibold text-foreground">{totalCommits}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCommitPage((p) => Math.max(1, p - 1))}
                        disabled={commitPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Prev
                      </Button>
                      <div className="text-sm font-medium px-2">
                        Page {commitPage} / {totalCommitPages}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCommitPage((p) => Math.min(totalCommitPages, p + 1))}
                        disabled={commitPage === totalCommitPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-muted-foreground justify-center p-8 border border-dashed rounded-xl border-border/50">
                <Clock className="h-5 w-5" />
                <p className="text-sm">No commits pushed yet.</p>
              </div>
            )}
          </GlassCard>
        )}

        {!isGithubRound && isLeader && (
        <Button 
          type="submit" 
          variant="orange" 
          className="w-full h-14 text-lg rounded-xl shadow-[0_0_20px_rgba(243,112,33,0.3)]"
          disabled={
            isReadOnly ||
            isDeadlinePassed ||
            submitMutation.isPending ||
            !canSubmit ||
            !canSubmitPayload
          }
        >
          {submitMutation.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <CheckCircle2 className="h-5 w-5 mr-2" />
          )}
          {isReadOnly
            ? "View Only"
            : latestSubmission
              ? "Resubmit Project"
              : "Submit Project"}
        </Button>
        )}
      </form>
  </div>
  );
}
