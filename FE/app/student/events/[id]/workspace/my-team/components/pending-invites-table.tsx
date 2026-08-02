"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { enqueueSnackbar } from "notistack";
import { Send, X, Clock, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PendingInvitation = {
    id: number;
    email: string;
    status: string;
    createdAt?: string;
};

type TeamSummary = {
    id: number;
    eventId: number;
};

type PendingInvitesTableProps = {
    invites: PendingInvitation[];
    isCurrentUserLeader: boolean;
    team: TeamSummary;
    isEventActive: boolean;
};

export function PendingInvitesTable({ invites, isCurrentUserLeader, team, isEventActive }: PendingInvitesTableProps) {
    const queryClient = useQueryClient();

    const cancelMutation = useMutation({
        mutationFn: async (invitationId: number) => {
            if (!isEventActive) throw new Error("Team roster is locked for this event.");
            return axiosClient.delete(`/student/teams/${team.id}/invitations/${invitationId}`);
        },
        onSuccess: () => {
            enqueueSnackbar('Invitation canceled successfully!', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['studentEventStatus', String(team.eventId)] });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (error: any) => {
            enqueueSnackbar(error.response?.data?.message || 'Failed to cancel invitation', { variant: 'error' });
        }
    });

    const resendMutation = useMutation({
        mutationFn: async (invitationId: number) =>
            axiosClient.post(`/student/teams/${team.id}/invitations/${invitationId}/resend`),
        onSuccess: () => {
            enqueueSnackbar('Invitation email resent!', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['studentEventStatus', String(team.eventId)] });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (error: any) => {
            enqueueSnackbar(error.response?.data?.message || 'Failed to resend invitation', { variant: 'error' });
        },
    });

    const handleCancelInvite = (invitationId: number) => {
        if (!isEventActive) {
            enqueueSnackbar('Team roster is locked for this event.', { variant: 'warning' });
            return;
        }
        cancelMutation.mutate(invitationId);
    };

    if (invites.length === 0) {
        return null;
    }

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                        <tr>
                            <th className="px-4 py-3 font-medium">Invitee</th>
                            <th className="px-4 py-3 font-medium">Role</th>
                            <th className="px-4 py-3 font-medium">Invited At</th>
                            {isCurrentUserLeader && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {invites.map((invite) => {
                            const name = "Pending invite";
                            const email = invite.email;
                            
                            return (
                                <tr key={email} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-foreground">{name}</div>
                                        <div className="text-xs text-muted-foreground">{email}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border-amber-500/20">
                                            MEMBER
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center text-xs text-muted-foreground">
                                            <Clock className="w-3 h-3 mr-1.5" />
                                            {invite.createdAt ? new Date(invite.createdAt).toLocaleDateString() : "Just now"}
                                        </div>
                                    </td>
                                    {isCurrentUserLeader && (
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="rounded-lg h-8 w-8 text-blue-400 hover:text-blue-500 hover:bg-blue-400/10" 
                                                    title="Resend invitation email"
                                                    onClick={() => resendMutation.mutate(invite.id)}
                                                    disabled={resendMutation.isPending || !isEventActive}
                                                >
                                                    <Send className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="rounded-lg h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-400/10 disabled:opacity-50" 
                                                    title={!isEventActive ? "Team roster is locked after the event starts." : "Cancel Invitation"}
                                                    onClick={() => handleCancelInvite(invite.id)}
                                                    disabled={cancelMutation.isPending || !isEventActive}
                                                >
                                                    {cancelMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                                                </Button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
