"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { enqueueSnackbar } from "notistack";
import { MoreHorizontal, Trash2, Crown, LogOut, Loader2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

type MemberListItemProps = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    member: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    teamInfo: any;
    isCurrentUserLeader: boolean;
    currentUserId?: number;
    isEventActive: boolean;
};

export function MemberListItem({ member, teamInfo, isCurrentUserLeader, currentUserId, isEventActive }: MemberListItemProps) {
    const queryClient = useQueryClient();
    const team = teamInfo.team;
    
    const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

    const isMemberLeader = member.role === "leader";
    const isCurrentUser = member.userId === currentUserId;
    const canManage = isCurrentUserLeader && !isCurrentUser;

    // Extract initials
    const name = member.user?.name || "Unknown User";
    const initials = name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();

    // Mutations
    const transferMutation = useMutation({
        mutationFn: async () => {
            if (!isEventActive) throw new Error("Team roster is locked for this event.");
            return axiosClient.post(`/student/teams/${team.id}/transfer-leadership/${member.userId}`);
        },
        onSuccess: () => {
            enqueueSnackbar('Leadership transferred successfully!', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['studentEventStatus', String(team.eventId)] });
            setIsTransferDialogOpen(false);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (error: any) => {
            enqueueSnackbar(error.response?.data?.message || 'Failed to transfer leadership', { variant: 'error' });
        }
    });

    const updateTeamMutation = useMutation({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mutationFn: async (data: any) => {
            if (!isEventActive) throw new Error("Team roster is locked for this event.");
            return axiosClient.put(`/student/teams/register/team/${team.eventId}`, data);
        },
        onSuccess: () => {
            enqueueSnackbar('Member removed successfully!', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['studentEventStatus', String(team.eventId)] });
            setIsRemoveDialogOpen(false);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (error: any) => {
            enqueueSnackbar(error.response?.data?.message || 'Failed to remove member', { variant: 'error' });
        }
    });

    const handleRemoveMember = () => {
        if (!isEventActive) {
            enqueueSnackbar('Team roster is locked for this event.', { variant: 'warning' });
            return;
        }
        // Keep everyone except this member
        const currentEmails = team.members
            .filter((m: any) => m.role === "member")
            .map((m: any) => m.user.email);
            
        const targetEmail = member.user.email;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newEmails = currentEmails.filter((email: string) => email !== targetEmail);

        updateTeamMutation.mutate({
            trackId: team.trackId,
            teamName: team.name,
            memberEmails: newEmails,
        });
    };

    return (
        <>
            <div className="flex items-center justify-between gap-4 rounded-[16px] bg-card p-4 border border-border hover:bg-muted/50 transition-colors">
                {/* Left: Avatar & Info */}
                <div className="flex items-center gap-4 flex-1">
                    <Avatar className={`h-12 w-12 border ${isMemberLeader ? 'border-orange-500/50' : 'border-border'}`}>
                        {member.user?.avatarUrl && <AvatarImage src={member.user.avatarUrl} alt={name} className="object-cover" />}
                        <AvatarFallback className={isMemberLeader ? "bg-orange-500/10 text-orange-500 font-bold" : "bg-muted text-muted-foreground font-semibold"}>
                            {initials}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-base font-semibold text-foreground flex items-center gap-1.5">
                                {isMemberLeader && <Crown className="h-4 w-4 text-orange-500" />}
                                {name}
                            </p>
                            {isCurrentUser && (
                                <span className="text-[10px] bg-white/10 text-muted-foreground px-2 py-0.5 rounded-full font-medium border border-white/5">
                                    You
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            {member.user?.email}
                        </p>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center justify-end gap-2">
                    {canManage ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                <DropdownMenuLabel>Member Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {!isMemberLeader && (
                                    <>
                                        <DropdownMenuItem 
                                            className="text-orange-500 focus:text-orange-500 cursor-pointer" 
                                            onClick={(event) => {
                                                if (!isEventActive) {
                                                    event.preventDefault();
                                                    enqueueSnackbar("Team roster is locked for this event.", { variant: "warning" });
                                                    return;
                                                }
                                                setIsTransferDialogOpen(true);
                                            }}
                                        >
                                            <Crown className="mr-2 h-4 w-4" />
                                            Make Leader
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem 
                                            className={`focus:text-red-500 cursor-pointer ${!isEventActive ? "opacity-50 text-muted-foreground" : "text-red-500"}`}
                                            onClick={(e) => {
                                                if (!isEventActive) {
                                                    e.preventDefault();
                                                    enqueueSnackbar("Team roster is locked after the event starts.", { variant: "warning" });
                                                    return;
                                                }
                                                setIsRemoveDialogOpen(true);
                                            }}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Remove Member
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>

                    ) : (
                        <div className="h-8 w-8" /> /* Placeholder for alignment */
                    )}
                </div>
            </div>

            {/* Transfer Leadership Dialog */}
            <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl border-border bg-background/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-orange-500">
                            <Crown className="h-5 w-5" />
                            Transfer Leadership
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to transfer team leadership to <strong>{name}</strong>? 
                            You will become a regular member and lose the ability to manage the team.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 sm:justify-end gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={() => setIsTransferDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button 
                            variant="orange" 
                            className="rounded-xl"
                            onClick={() => transferMutation.mutate()}
                            disabled={!isEventActive || transferMutation.isPending}
                        >
                            {transferMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Crown className="h-4 w-4 mr-2" />}
                            Confirm Transfer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Remove Member Dialog */}
            <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl border-border bg-background/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-red-500">
                            <Trash2 className="h-5 w-5" />
                            Remove Member
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove <strong>{name}</strong> from the team? 
                            This action cannot be undone, and they will need a new invitation to rejoin.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 sm:justify-end gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={() => setIsRemoveDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            className="rounded-xl bg-red-500 hover:bg-red-600 text-white"
                            onClick={handleRemoveMember}
                            disabled={!isEventActive || updateTeamMutation.isPending}
                        >
                            {updateTeamMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Remove Member
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
