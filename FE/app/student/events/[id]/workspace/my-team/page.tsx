/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { enqueueSnackbar } from "notistack";
import {
    Mail,
    Search,
    Send,
    SlidersHorizontal,
    UserPlus,
    UsersRound,
    Crown,
    LogOut,
    Check,
    GraduationCap
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { MemberListItem } from "./components/member-list-item";
import { PendingInvitesTable } from "./components/pending-invites-table";
import { useWorkspaceAccess } from "../workspace-access";

export default function TeamMembersPage() {
    const router = useRouter();
    const params = useParams();
    const eventId = params.id as string;
    const queryClient = useQueryClient();
    const { isReadOnly } = useWorkspaceAccess();

    const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("All");

    // Fetch Event Details to get Event Name
    const { data: event, isLoading: isEventLoading } = useQuery({
        queryKey: ['publicEvent', eventId],
        queryFn: async () => {
            const res = await axiosClient.get(`/public/events/${eventId}`);
            return res.data.data;
        },
    });

    // Fetch Student Registration Status (Includes Team Info and Members)
    const { data: studentStatus, isLoading: isStudentLoading } = useQuery({
        queryKey: ['studentEventStatus', eventId],
        queryFn: async () => {
            const res = await axiosClient.get(`/student/teams/status/${eventId}`);
            return res.data.data;
        },
    });

    const updateTeamMutation = useMutation({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mutationFn: async (data: any) => {
            if (isReadOnly) throw new Error("This event has ended. The workspace is view only.");
            return axiosClient.put(`/student/teams/register/team/${eventId}`, data);
        },
        onSuccess: () => {
            enqueueSnackbar('Team updated successfully!', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['studentEventStatus', eventId] });
            setIsInviteDialogOpen(false);
            setInviteEmail("");
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (error: any) => {
            const message = error.response?.data?.message || 'Failed to update team';
            enqueueSnackbar(message, { variant: 'error' });
        }
    });

    const isLoading = isEventLoading || isStudentLoading;

    if (isLoading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500"></div>
            </div>
        );
    }

    const teamInfo = studentStatus?.teamInfo;

    if (!teamInfo || !teamInfo.team) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
                <UsersRound className="h-16 w-16 text-muted-foreground opacity-50 mb-4" />
                <h2 className="text-2xl font-bold text-foreground">No Team Found</h2>
                <p className="mt-2 text-muted-foreground max-w-md">
                    You haven&apos;t joined or created a team for this event yet, or your team registration was rejected.
                </p>
            </div>
        );
    }

    const team = teamInfo.team;
    const isLeader = teamInfo.role === "leader";
    const isEventActive = !isReadOnly && event?.status === "active";
    const members = team.members || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeMembers = members.filter((m: any) => m.status === "accepted");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingMembers = members.filter((m: any) => m.status === "pending");

    // Prepare data for inviting a new member
    const handleSendInvite = () => {
        if (isReadOnly) {
            enqueueSnackbar('This event has ended. The workspace is view only.', { variant: 'warning' });
            return;
        }
        if (!inviteEmail.trim()) {
            enqueueSnackbar('Please enter an email address', { variant: 'warning' });
            return;
        }

        // Get current emails
        const currentEmails = activeMembers
            .filter((m: any) => m.role === "member")
            .map((m: any) => m.user.email);

        const pendingEmails = pendingMembers.map((m: any) => m.user.email);

        const newEmails = [...currentEmails, ...pendingEmails, inviteEmail.trim()];

        updateTeamMutation.mutate({
            trackId: team.trackId,
            teamName: team.name,
            memberEmails: newEmails,
        });
    };

    // Filter active members
    const filteredMembers = activeMembers.filter((m: any) => {
        const nameMatch = m.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());
        const roleMatch = roleFilter === "All" || m.role?.toLowerCase() === roleFilter.toLowerCase();
        return nameMatch && roleMatch;
    });

    const maxMembers = team.track?.maxMembersPerTeam || 5; // Default fallback

    return (
        <div className="mx-auto max-w-[1500px] space-y-6 animate-in fade-in duration-500">
            <header className="border-b border-border pb-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="text-sm font-medium uppercase tracking-[0.2em] text-orange-500 flex items-center gap-3">
                            {event?.name || "Competition Event"}
                            <Badge variant="outline" className={isLeader ? "bg-orange-500/10 text-orange-500 border-orange-500/20 pointer-events-none" : "pointer-events-none"}>
                                {isLeader ? (
                                    <span className="flex items-center gap-1"><Crown className="h-3 w-3" /> LEADER VIEW</span>
                                ) : (
                                    "MEMBER VIEW"
                                )}
                            </Badge>
                        </div>
                        <h1 className="mt-3 text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
                            {team.name}
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
                            View your team's roster, track pending invitations, and collaborate towards victory.
                        </p>
                        {team.mentorAssignments && team.mentorAssignments.length > 0 && (
                            <div className="mt-5 flex items-center gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 w-fit pr-6">
                                <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                    {team.mentorAssignments[0].mentor?.avatarUrl ? (
                                        <img src={team.mentorAssignments[0].mentor.avatarUrl} alt={team.mentorAssignments[0].mentor.name} className="h-full w-full rounded-full object-cover" />
                                    ) : (
                                        <GraduationCap className="h-5 w-5 text-blue-500" />
                                    )}
                                </div>
                                <div onClick={() => router.push(`/student/events/${eventId}/workspace/mentor`)} className="cursor-pointer">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-0.5">Team Mentor</p>
                                    <p className="text-sm font-medium text-foreground">{team.mentorAssignments[0].mentor?.name}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="outline" className="px-4 py-2 bg-card border-border shadow-sm text-sm">
                            <UsersRound className="h-4 w-4 mr-2 inline-block text-muted-foreground" />
                            {activeMembers.length} / {maxMembers} Members
                        </Badge>
                        {isLeader ? (
                            <Dialog open={isInviteDialogOpen} onOpenChange={(open) => isEventActive && setIsInviteDialogOpen(open)}>
                                <DialogTrigger
                                    render={
                                        <Button
                                            variant="orange"
                                            className="rounded-xl px-5 shadow-[0_0_15px_rgba(243,112,33,0.3)]"
                                            disabled={!isEventActive}
                                            title={!isEventActive ? "Team roster is locked after the event starts." : "Invite a new member"}
                                        />
                                    }
                                >
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Invite Member
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md rounded-2xl border-border bg-background/95 backdrop-blur-xl">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                            <UserPlus className="h-5 w-5 text-orange-500" />
                                            Invite to {team.name}
                                        </DialogTitle>
                                        <DialogDescription>
                                            Send a secure invitation to a student to join your team.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <label className="block">
                                            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                                Student Email
                                            </span>
                                            <div className="relative">
                                                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    placeholder="student@fpt.edu.vn"
                                                    type="email"
                                                    value={inviteEmail}
                                                    onChange={(e) => setInviteEmail(e.target.value)}
                                                    className="h-12 rounded-xl border-border bg-card pl-11 focus-visible:ring-orange-500/50"
                                                />
                                            </div>
                                            <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                                                <Check className="h-3 w-3 text-green-500" />
                                                Student must have a registered account.
                                            </p>
                                        </label>
                                        <Button
                                            variant="orange"
                                            className="w-full rounded-xl mt-4 h-12 text-base font-semibold"
                                            onClick={handleSendInvite}
                                            disabled={updateTeamMutation.isPending}
                                        >
                                            <Send className="h-4 w-4 mr-2" />
                                            {updateTeamMutation.isPending ? "Sending..." : "Send Invite"}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        ) : null}
                    </div>
                </div>
            </header>

            <GlassCard className="rounded-[20px] bg-card p-4 shadow-sm border border-border/50">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="relative w-full xl:max-w-md">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search member by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-11 rounded-xl border-border bg-background pl-11 focus-visible:ring-orange-500/50"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" className="rounded-xl border-border bg-background h-10 px-4 pointer-events-none">
                            <SlidersHorizontal className="h-4 w-4 mr-2" />
                            Filter Role
                        </Button>

                        {["All", "Leader", "Member"].map((filter) => (
                            <Button
                                key={filter}
                                variant={filter === roleFilter ? "orange" : "ghost"}
                                size="sm"
                                onClick={() => setRoleFilter(filter)}
                                className={`rounded-xl h-10 px-4 ${filter === roleFilter ? "shadow-sm" : "hover:bg-muted"}`}
                            >
                                {filter}
                            </Button>
                        ))}
                    </div>
                </div>
            </GlassCard>

            <div className="space-y-8">
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-foreground px-1 flex items-center gap-2">
                        Active Members
                        <Badge variant="outline" className="ml-1 bg-muted/50">{filteredMembers.length}</Badge>
                    </h3>
                    <div className="space-y-3">
                        {filteredMembers.map((member: any) => (
                            <MemberListItem
                                key={member.id}
                                member={member}
                                teamInfo={teamInfo}
                                isCurrentUserLeader={isLeader}
                                currentUserId={studentStatus?.individualRegistration?.userId}
                                isEventActive={isEventActive}
                            />
                        ))}
                        {filteredMembers.length === 0 && (
                            <div className="p-8 text-center border border-dashed border-border rounded-[20px]">
                                <p className="text-muted-foreground">No active members found matching your search.</p>
                            </div>
                        )}
                    </div>
                </div>

                {pendingMembers.length > 0 && (
                    <div className="pt-4 border-t border-border">
                        <h3 className="text-lg font-bold mb-4 text-foreground flex items-center gap-2 px-1">
                            Pending Invitations
                            <Badge className="ml-1 bg-amber-500/20 text-amber-500 border-amber-500/30 shadow-sm pointer-events-none">
                                {pendingMembers.length}
                            </Badge>
                        </h3>
                        <PendingInvitesTable
                            invites={pendingMembers}
                            isCurrentUserLeader={isLeader}
                            team={team}
                            isEventActive={isEventActive}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
