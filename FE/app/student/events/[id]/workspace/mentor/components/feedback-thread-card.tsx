import { MessageSquareText, CheckCircle2, Circle, Check } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import {
    updateStudentMentorFeedbackStatus,
    type StudentWorkspaceFeedback,
    type StudentWorkspaceMentor,
} from "@/lib/api/mentor.api";
import { useWorkspaceAccess } from "../../workspace-access";

type FeedbackThreadCardProps = {
    items: StudentWorkspaceFeedback[];
    mentor?: StudentWorkspaceMentor | null;
};

function initials(name?: string | null) {
    return (name || "M")
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

function formatDate(value?: string | null) {
    return value ? new Date(value).toLocaleString() : "Time unavailable";
}

export function FeedbackThreadCard({ items, mentor }: FeedbackThreadCardProps) {
    const queryClient = useQueryClient();
    const params = useParams();
    const eventId = Number(params.id);
    const { isReadOnly } = useWorkspaceAccess();

    const updateStatusMutation = useMutation({
        mutationFn: ({ feedbackId, status }: { feedbackId: number | string, status: "unread" | "acknowledged" | "completed" }) => {
            if (isReadOnly) throw new Error("This event has ended. The workspace is view only.");
            return updateStudentMentorFeedbackStatus(feedbackId, status);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["studentMentorWorkspace", eventId] });
        },
    });

    const handleStatusClick = (feedbackId: number | string, currentStatus: string) => {
        if (isReadOnly) return;
        if (currentStatus === "unread") {
            updateStatusMutation.mutate({ feedbackId, status: "completed" });
        }
    };

    return (
        <GlassCard className="rounded-[24px] bg-card p-6 hover:-translate-y-1">
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-foreground">
                    Mentor Feedback Thread
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Threaded review notes, replies, and resolution state.
                </p>
            </div>

            <div className="space-y-4">
                {items.length === 0 ? (
                    <div className="flex min-h-40 flex-col items-center justify-center rounded-[22px] border border-dashed border-border text-center">
                        <MessageSquareText className="h-7 w-7 text-muted-foreground" />
                        <p className="mt-3 font-medium">No mentor feedback yet</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Published feedback from the backend will appear here.
                        </p>
                    </div>
                ) : null}
                {items.map((item) => {
                    const feedbackMentor = item.mentor || mentor;
                    const unresolved = item.status !== "completed" && item.status !== "resolved";
                    const avatarUrl =
                        feedbackMentor?.avatarUrl ||
                        feedbackMentor?.avatar_url ||
                        undefined;
                    
                    const isUpdating = updateStatusMutation.isPending && updateStatusMutation.variables?.feedbackId === item.id;
                    const capitalizedStatus = item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : "Feedback";

                    return (
                        <div
                            key={item.id}
                            className={cn(
                                "rounded-[22px] border bg-white/[0.035] p-4",
                                unresolved ? "border-orange-500/25 shadow-[0_0_30px_rgba(243,112,33,0.08)]" : "border-border"
                            )}
                        >
                            <div className="flex gap-3">
                                <Avatar className="h-11 w-11 border border-orange-500/25">
                                    {avatarUrl ? (
                                        <AvatarImage
                                            src={avatarUrl}
                                            alt={feedbackMentor?.name || "Mentor"}
                                        />
                                    ) : null}
                                    <AvatarFallback>
                                        {initials(feedbackMentor?.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-foreground">
                                                {feedbackMentor?.name || "Assigned Mentor"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDate(
                                                    item.publishedAt ||
                                                        item.updatedAt ||
                                                        item.createdAt
                                                )}
                                                {item.submission?.round?.name
                                                    ? ` · ${item.submission.round.name}`
                                                    : ""}
                                            </p>
                                        </div>

                                            <div className="flex flex-col items-end gap-3">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={unresolved ? "warning" : "success"}>
                                                        {capitalizedStatus}
                                                    </Badge>
                                                    {item.status === "unread" && (
                                                        <Button 
                                                            size="icon" 
                                                            variant="ghost"
                                                            title="Mark as Completed"
                                                            className="h-6 w-6 rounded-full text-blue-500 hover:bg-blue-500/10 hover:text-blue-600"
                                                            disabled={isReadOnly || isUpdating}
                                                            onClick={() => handleStatusClick(item.id, "unread")}
                                                        >
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                    </div>

                                    <p className="mt-4 text-sm leading-6 text-foreground/90">
                                        {item.content}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </GlassCard>
    );
}
