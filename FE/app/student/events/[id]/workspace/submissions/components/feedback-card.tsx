import { MessageSquareText } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

import type { FeedbackSummary } from "../mock-data";

type FeedbackCardProps = {
    feedback: FeedbackSummary;
};

export function FeedbackCard({ feedback }: FeedbackCardProps) {
    return (
        <GlassCard className="rounded-[24px] bg-card p-6 hover:-translate-y-1">
            <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        Mentor / Judge Feedback
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Latest review notes for this submission.
                    </p>
                </div>
                <Badge variant="warning">
                    {feedback.status}
                </Badge>
            </div>

            <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border border-orange-500/25">
                    <AvatarFallback>
                        {feedback.reviewerInitials}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold text-foreground">
                        {feedback.reviewerName}
                    </p>
                    <Badge variant="outline" className="mt-1">
                        {feedback.role}
                    </Badge>
                </div>
            </div>

            <blockquote className="mt-5 rounded-[20px] border border-orange-500/15 bg-orange-500/5 p-5 text-sm leading-6 text-foreground/90">
                “{feedback.comment}”
            </blockquote>

            <Button variant="soft" className="mt-5 rounded-2xl">
                <MessageSquareText className="h-4 w-4" />
                View Feedback
            </Button>
        </GlassCard>
    );
}
