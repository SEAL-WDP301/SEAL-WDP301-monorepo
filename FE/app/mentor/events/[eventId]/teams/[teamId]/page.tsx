"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ExternalLink, FileText, Send, Clock, User, 
  MessageSquare, MessageCircle, Loader2, Users, Calendar, Target,
  CheckCircle2, X, Minus, Edit2, Trash2, Trophy, Sparkles, AlertCircle, ChevronDown, Layers
} from "lucide-react";
import { enqueueSnackbar } from "notistack";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FloatingTeamChat } from "@/components/floating-team-chat";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { 
  generateMentorAiDraft,
  getMentorTeam, 
  getMentorTeamSubmissions,
  getMentorTeams,
  type MentorAiDraftResult,
} from "@/lib/api/mentor.api";
import { axiosClient } from "@/lib/axios";
import { MentorPageHeader } from "@/app/mentor/_components/mentor-page-header";
import { useSocket } from "@/lib/hooks/useSocket";
import {
  MentorEmptyState,
  MentorErrorState,
  MentorLoadingState,
} from "@/app/mentor/_components/mentor-query-state";
import { AiMentorDraftPanel } from "./components/ai-mentor-draft-panel";

function initials(value?: string | null) {
  return (value || "?")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ResourceLink({
  label,
  href,
  file = false,
}: {
  label: string;
  href: string;
  file?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:border-orange-500/40 hover:bg-orange-500/5"
    >
      <span className="flex items-center gap-2 font-medium text-sm">
        {file ? (
          <FileText className="h-4 w-4 text-orange-500" />
        ) : (
          <ExternalLink className="h-4 w-4 text-orange-500" />
        )}
        {label}
      </span>
      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-50" />
    </a>
  );
}

function getSubmissionStatusVariant(status?: string): "default" | "success" | "warning" | "destructive" | "outline" | "highlight" {
  const s = (status || "").toLowerCase();
  if (s === "submitted") return "success";
  if (s === "graded" || s === "evaluated") return "highlight";
  if (s === "late" || s === "overdue") return "destructive";
  if (s === "draft" || s === "pending") return "warning";
  return "outline";
}

export default function MentorTeamDashboard() {
  const params = useParams();
  const teamId = params.teamId as string;
  const queryClient = useQueryClient();

  const [feedbackContent, setFeedbackContent] = useState("");
  const [editingFeedbackId, setEditingFeedbackId] = useState<number | null>(null);
  const [aiDraft, setAiDraft] = useState<MentorAiDraftResult | null>(null);
  
  // To handle multiple submissions, we default to the latest one
  const [activeSubmissionId, setActiveSubmissionId] = useState<number | null>(null);

  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !teamId) return;

    socket.emit("join_team_room", Number(teamId));

    socket.on("feedback_updated", () => {
      queryClient.invalidateQueries({ queryKey: ["mentorTeamSubmissions", teamId] });
      queryClient.invalidateQueries({ queryKey: ["mentorTeam", teamId] });
    });

    return () => {
      socket.emit("leave_team_room", Number(teamId));
      socket.off("feedback_updated");
    };
  }, [socket, teamId, queryClient]);

  const router = useRouter();
  const teamsQuery = useQuery({
    queryKey: ["mentorTeams", params.eventId],
    queryFn: () => getMentorTeams(params.eventId as string),
  });
  const allMentorTeams = teamsQuery.data || [];

  const teamQuery = useQuery({
    queryKey: ["mentorTeam", teamId],
    queryFn: () => getMentorTeam(teamId),
  });

  const submissionsQuery = useQuery({
    queryKey: ["mentorTeamSubmissions", teamId],
    queryFn: async () => {
      const data = await getMentorTeamSubmissions(teamId);
      // Auto-select latest submission
      if (data && data.length > 0 && !activeSubmissionId) {
        setActiveSubmissionId(data[data.length - 1].id);
      }
      return data;
    },
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async ({ submissionId, content }: { submissionId: number, content: string }) => {
      const res = await axiosClient.post(`/mentor/submissions/${submissionId}/feedback`, { content });
      return res.data;
    },
    onSuccess: () => {
      enqueueSnackbar("Feedback submitted successfully!", { variant: "success" });
      setFeedbackContent("");
      queryClient.invalidateQueries({ queryKey: ["mentorTeamSubmissions", teamId] });
    },
    onError: () => {
      enqueueSnackbar("Failed to submit feedback. Please try again.", { variant: "error" });
    }
  });

  const updateFeedbackMutation = useMutation({
    mutationFn: async ({ submissionId, feedbackId, content }: { submissionId: number, feedbackId: number, content: string }) => {
      const res = await axiosClient.patch(`/mentor/feedback/${feedbackId}`, { content });
      return res.data;
    },
    onSuccess: () => {
      enqueueSnackbar("Feedback updated successfully!", { variant: "success" });
      setEditingFeedbackId(null);
      setFeedbackContent("");
      queryClient.invalidateQueries({ queryKey: ["mentorTeamSubmissions", teamId] });
    },
    onError: () => {
      enqueueSnackbar("Failed to update feedback.", { variant: "error" });
    }
  });

  const deleteFeedbackMutation = useMutation({
    mutationFn: async ({ submissionId, feedbackId }: { submissionId: number, feedbackId: number }) => {
      const res = await axiosClient.delete(`/mentor/feedback/${feedbackId}`);
      return res.data;
    },
    onSuccess: () => {
      enqueueSnackbar("Feedback deleted successfully!", { variant: "success" });
      setEditingFeedbackId(null);
      setFeedbackContent("");
      queryClient.invalidateQueries({ queryKey: ["mentorTeamSubmissions", teamId] });
    },
    onError: () => {
      enqueueSnackbar("Failed to delete feedback.", { variant: "error" });
    }
  });

  const aiDraftMutation = useMutation({
    mutationFn: (submissionId: number) => generateMentorAiDraft(submissionId),
    onSuccess: (data) => {
      setAiDraft(data);
      enqueueSnackbar("AI mentoring draft ready", { variant: "success" });
    },
    onError: (error: any) => {
      enqueueSnackbar(
        error?.response?.data?.message || "Failed to generate AI draft",
        { variant: "error" },
      );
    },
  });

  if (teamQuery.isLoading) return <MentorLoadingState />;
  if (teamQuery.isError || !teamQuery.data) return <MentorErrorState />;

  const team = teamQuery.data;
  const submissions = submissionsQuery.data || [];
  
  const activeSubmission = activeSubmissionId 
    ? submissions.find(s => s.id === activeSubmissionId) 
    : (submissions.length > 0 ? submissions[submissions.length - 1] : null);

  const hasResources = Boolean(
    activeSubmission && (
      activeSubmission.fileUrl ||
      activeSubmission.githubUrl ||
      activeSubmission.demoUrl ||
      activeSubmission.slideUrl
    )
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-20 animate-in fade-in duration-500">
      <MentorPageHeader
        title={
          <div className="flex items-center gap-3">
            {team.name}
            {isConnected && (
              <div title="Real-time connected" className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </div>
            )}
          </div>
        }
        subtitle="Manage team, review submissions, and provide real-time feedback."
        actions={
          <div className="flex items-center gap-3">
            {allMentorTeams.length > 1 && (
              <div className="flex items-center gap-2 bg-background/80 border border-border px-3.5 py-2 rounded-xl shadow-sm">
                <Users className="h-4 w-4 text-orange-500 shrink-0" />
                <span className="text-xs font-semibold text-muted-foreground shrink-0">Select Team:</span>
                <select
                  value={teamId}
                  onChange={(e) => router.push(`/mentor/events/${params.eventId}/teams/${e.target.value}`)}
                  className="bg-transparent text-sm font-bold text-foreground focus:outline-none cursor-pointer"
                >
                  {allMentorTeams.map((t) => (
                    <option key={t.id} value={t.id} className="bg-popover text-popover-foreground">
                      {t.name} ({t.track?.name || "No track"})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`/mentor/events/${params.eventId}/teams`}>Back to Teams</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] items-start">
        {/* LEFT COLUMN: CONTEXT & IDENTITY */}
        <aside className="space-y-6 sticky top-6">
          
          {/* Round Progression & Advancement Roadmap */}
          <GlassCard glow className="rounded-[24px] bg-gradient-to-br from-card to-background border-orange-500/20 p-6 relative overflow-hidden group">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="h-5 w-5 text-orange-500" />
              <h2 className="text-lg font-bold">Round Progression & Status</h2>
            </div>

            <div className="space-y-3">
              {team.teamRounds && team.teamRounds.length > 0 ? (
                team.teamRounds.map((tr, index) => {
                  const isAdvanced = tr.status === "advanced";
                  const isCompeting = tr.status === "competing";
                  const isEliminated = tr.status === "eliminated";
                  return (
                    <div
                      key={tr.id || tr.roundId || index}
                      className={`p-4 rounded-2xl border transition-all ${
                        isAdvanced
                          ? "border-green-500/40 bg-gradient-to-r from-green-500/10 to-transparent shadow-[0_0_15px_-5px_rgba(34,197,94,0.3)]"
                          : isCompeting
                          ? "border-orange-500/40 bg-orange-500/5"
                          : isEliminated
                          ? "border-red-500/30 bg-red-500/5"
                          : "border-border bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-foreground">
                          {tr.round?.name || `Round ${index + 1}`}
                        </span>
                        {isAdvanced && (
                          <Badge variant="success" className="gap-1 shadow-sm font-bold text-[11px]">
                            👑 Advanced
                          </Badge>
                        )}
                        {isCompeting && (
                          <Badge variant="warning" className="gap-1 font-bold text-[11px]">
                            ⚔️ Competing
                          </Badge>
                        )}
                        {isEliminated && (
                          <Badge variant="destructive" className="gap-1 font-bold text-[11px]">
                            🔴 Eliminated
                          </Badge>
                        )}
                        {!isAdvanced && !isCompeting && !isEliminated && (
                          <Badge variant="outline" className="text-[11px]">{tr.status || "Pending"}</Badge>
                        )}
                      </div>

                      {tr.score != null && (
                        <p className="text-xs text-muted-foreground font-medium mb-2">
                          Score: <span className="font-bold text-foreground">{Number(tr.score).toFixed(2)}</span> / 10
                        </p>
                      )}

                      {tr.round?.problemFileUrl ? (
                        <div className="pt-2 border-t border-border/40">
                          <a
                            href={tr.round.problemFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 font-semibold underline underline-offset-4"
                          >
                            <FileText className="h-3.5 w-3.5" /> 📌 Download Topic File
                          </a>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic pt-1">
                          No topic attachment for this round
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-3 text-xs text-muted-foreground text-center">
                  No round status recorded for this team.
                </div>
              )}
            </div>
          </GlassCard>

          {/* Unified Team Roster */}
          <GlassCard className="rounded-[24px] bg-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Team Roster
              </h2>
              <Badge variant="outline">{team.track?.name || "No track"}</Badge>
            </div>

            <div className="space-y-3">
              {/* Leader */}
              {team.leader && (() => {
                const leaderMember = (team.members || []).find(m => m.user?.email === team.leader?.email);
                const avatarUrl = leaderMember?.user?.avatar_url || leaderMember?.user?.avatarUrl || (team.leader as any).avatar_url || (team.leader as any).avatarUrl;
                return (
                  <div className="flex items-center gap-3 rounded-2xl border border-orange-500/30 bg-orange-500/5 p-3">
                    <Avatar className="h-10 w-10 border border-orange-500/50">
                      {avatarUrl && <AvatarImage src={avatarUrl} />}
                      <AvatarFallback className="bg-orange-500/20 text-orange-600">{initials(team.leader.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {team.leader.name || "Unknown"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {team.leader.email || "No email"}
                      </p>
                    </div>
                    <Badge variant="highlight" className="text-[10px] h-5 px-1.5">Leader</Badge>
                  </div>
                );
              })()}

              {/* Members */}
              {(team.members || []).filter(m => m.user?.email !== team.leader?.email).map((member, index) => (
                <div
                  key={member.id || member.user?.id || index}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.user?.avatar_url || member.user?.avatarUrl || ""} />
                    <AvatarFallback>{initials(member.user?.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {member.user?.name || "Unknown member"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.user?.email || "No email"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
          
        </aside>

        {/* RIGHT COLUMN: ACTION & ASSESSMENT */}
        <main className="space-y-6">
          
          {/* Active Submission Viewer */}
          <GlassCard className="rounded-[24px] bg-card p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <FileText className="h-6 w-6 text-primary" />
                  Submission Assessment
                </h2>
                <p className="text-muted-foreground mt-1">Review the team's materials and provide feedback.</p>
              </div>
              
                  {submissions.length > 1 && (
                <select 
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm focus-visible:ring-1 focus-visible:ring-primary"
                  value={activeSubmissionId || ""}
                  onChange={(e) => {
                    setActiveSubmissionId(Number(e.target.value));
                    setAiDraft(null);
                    setEditingFeedbackId(null);
                    setFeedbackContent("");
                  }}
                >
                  {submissions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.round?.name || `Round ${s.roundId}`} - {new Date(s.updatedAt || "").toLocaleDateString()}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {submissionsQuery.isLoading ? (
              <MentorLoadingState />
            ) : submissionsQuery.isError ? (
              <MentorErrorState />
            ) : !activeSubmission ? (
              <MentorEmptyState
                title="No submissions"
                description="This assigned team has not submitted any work yet."
              />
            ) : (
              <div className="space-y-6">
                
                {/* Submission Meta */}
                <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl border border-border">
                  <Badge variant={getSubmissionStatusVariant(activeSubmission.status || "submitted")} className="capitalize px-3 py-1 text-sm">
                    {activeSubmission.status || "submitted"}
                  </Badge>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Updated: {activeSubmission.updatedAt ? new Date(activeSubmission.updatedAt).toLocaleString() : "Unknown"}
                  </div>
                </div>

                {/* Resources Grid */}
                {hasResources ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {activeSubmission.fileUrl && <ResourceLink label="Submitted Document" href={activeSubmission.fileUrl} file />}
                    {activeSubmission.githubUrl && <ResourceLink label="Git Repository" href={activeSubmission.githubUrl} />}
                    {activeSubmission.demoUrl && <ResourceLink label="Live Demo" href={activeSubmission.demoUrl} />}
                    {activeSubmission.slideUrl && <ResourceLink label="Presentation Slides" href={activeSubmission.slideUrl} />}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground bg-muted/30 rounded-2xl border border-border border-dashed">
                    No attachments or links provided in this submission.
                  </div>
                )}

                {/* Team Notes */}
                {activeSubmission.description && (
                  <div className="rounded-2xl border border-border bg-background p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      Team Notes
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {activeSubmission.description}
                    </p>
                  </div>
                )}

                <AiMentorDraftPanel
                  draft={
                    aiDraft && aiDraft.submissionId === activeSubmission.id
                      ? aiDraft
                      : null
                  }
                  isLoading={aiDraftMutation.isPending}
                  teamName={team.name}
                  roundName={
                    activeSubmission.round
                      ? `Round ${activeSubmission.round.roundNumber ?? ""}: ${activeSubmission.round.name}`.replace(
                          "Round :",
                          "Round",
                        )
                      : undefined
                  }
                  trackName={team.track?.name}
                  onGenerate={() => aiDraftMutation.mutate(activeSubmission.id)}
                  onUseDraft={(text) => {
                    setEditingFeedbackId(null);
                    setFeedbackContent(text);
                    enqueueSnackbar("Draft copied into the editor — review before submit", {
                      variant: "info",
                    });
                  }}
                  onDismiss={() => setAiDraft(null)}
                />

                <hr className="border-border my-8" />

                {/* Mentor Feedbacks List */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-orange-500" />
                      Mentor Assessment History
                    </h3>
                  </div>

                  {/* Existing Feedbacks */}
                  {activeSubmission.mentorFeedbacks && activeSubmission.mentorFeedbacks.length > 0 && (
                    <div className="space-y-4">
                      {activeSubmission.mentorFeedbacks.map((fb, idx) => (
                        <div key={fb.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                          {editingFeedbackId === fb.id ? (
                            <div className="space-y-4 animate-in fade-in duration-200">
                              <Textarea 
                                className="min-h-[120px] rounded-2xl bg-background resize-y focus:ring-orange-500/50 focus:border-orange-500"
                                value={feedbackContent}
                                onChange={(e) => setFeedbackContent(e.target.value)}
                              />
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" className="rounded-xl" onClick={() => { setEditingFeedbackId(null); setFeedbackContent(""); }}>Cancel</Button>
                                <Button variant="orange" className="rounded-xl shadow-[0_0_15px_rgba(243,112,33,0.3)]" disabled={!feedbackContent.trim() || updateFeedbackMutation.isPending} onClick={() => updateFeedbackMutation.mutate({ submissionId: activeSubmission.id, feedbackId: fb.id, content: feedbackContent })}>
                                  {updateFeedbackMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                  Update
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="text-xs text-muted-foreground bg-muted/30">
                                    #{activeSubmission.mentorFeedbacks!.length - idx} • {fb.createdAt ? new Date(fb.createdAt).toLocaleDateString() : "Just now"}
                                  </Badge>
                                  <Badge variant={
                                    fb.status === "completed" ? "success" : 
                                    fb.status === "acknowledged" ? "highlight" : "outline"
                                  }>
                                    {fb.status ? fb.status.charAt(0).toUpperCase() + fb.status.slice(1).toLowerCase() : "Unread"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground hover:text-blue-500" onClick={() => { setEditingFeedbackId(fb.id); setFeedbackContent(fb.content); }}>
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground hover:text-red-500" disabled={deleteFeedbackMutation.isPending} onClick={() => { if (window.confirm("Are you sure you want to delete this assessment?")) { deleteFeedbackMutation.mutate({ submissionId: activeSubmission.id, feedbackId: fb.id }); } }}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                {fb.content}
                              </p>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Feedback */}
                  {!editingFeedbackId && (
                    <div className="space-y-4 mt-6 animate-in fade-in zoom-in-95 duration-200">
                      <p className="text-sm font-medium text-muted-foreground ml-1">Add New Assessment</p>
                      <Textarea 
                        placeholder="Write your constructive feedback for the team here..."
                        className="min-h-[120px] rounded-2xl bg-muted/20 resize-y focus:ring-orange-500/50 focus:border-orange-500"
                        value={feedbackContent}
                        onChange={(e) => setFeedbackContent(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button 
                          variant="orange" 
                          className="rounded-xl shadow-[0_0_15px_rgba(243,112,33,0.3)]"
                          disabled={!feedbackContent.trim() || submitFeedbackMutation.isPending}
                          onClick={() => submitFeedbackMutation.mutate({ 
                            submissionId: activeSubmission.id, 
                            content: feedbackContent 
                          })}
                        >
                          {submitFeedbackMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                          Submit New Assessment
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </GlassCard>

        </main>
      </div>

      {/* Floating Chat Component */}
      <FloatingTeamChat teamId={Number(teamId)} />

    </div>
  );
}
