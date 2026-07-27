"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { enqueueSnackbar } from "notistack";
import { Search, CheckCircle, XCircle, Trash2, Eye, Crown, Users, UserPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TeamDetailsDialog } from "./team-details-dialog";
import { useAdminSocket } from "@/hooks/use-admin-socket";
import { useEffect } from "react";
import { useParams } from "next/navigation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function TeamsTab({ event }: { event: any }) {
    const queryClient = useQueryClient();
    const params = useParams();
    const roundId = params?.roundId as string | undefined;
    
    const [selectedTrackId, setSelectedTrackId] = useState<number | "all">("all");
    const [selectedStatus, setSelectedStatus] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
    
    // Bulk actions
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
    const [isBulkStatusOpen, setIsBulkStatusOpen] = useState(false);
    const [bulkActionType, setBulkActionType] = useState<'approved' | 'rejected'>('approved');
    const [bulkStatusReason, setBulkStatusReason] = useState("");

    const [eliminationReason, setEliminationReason] = useState("");
    const [teamToEliminate, setTeamToEliminate] = useState<number | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedTeamForDetails, setSelectedTeamForDetails] = useState<any | null>(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setPage(1); // Reset page on new search
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset page on filter changes
    useEffect(() => {
        setPage(1);
    }, [selectedTrackId, selectedStatus]);

    // Fetch Teams for the selected track and round
    const { data: queryData, isLoading } = useQuery({
        queryKey: ['organizerTeams', event.id, selectedTrackId, roundId, page, limit, selectedStatus, debouncedSearchTerm],
        queryFn: async () => {
            let url = `/organizer/teams/events/${event.id}?page=${page}&limit=${limit}&`;
            if (selectedTrackId !== "all") url += `trackId=${selectedTrackId}&`;
            if (roundId) url += `roundId=${roundId}&`;
            
            if (selectedStatus.startsWith("round_")) {
                url += `roundStatus=${selectedStatus.replace("round_", "")}&`;
            } else if (selectedStatus !== "all") {
                url += `status=${selectedStatus}&`;
            }

            if (debouncedSearchTerm) url += `search=${debouncedSearchTerm}&`;
            
            const finalUrl = url.endsWith('&') ? url.slice(0, -1) : url.endsWith('?') ? url.slice(0, -1) : url;
            const res = await axiosClient.get(finalUrl);
            return res.data;
        },
        enabled: true,
    });

    const teams = queryData?.data || [];
    const meta = queryData?.meta || { total: 0, page: 1, limit: 10, totalPages: 1 };
    const currentRound = event.rounds?.find((r: any) => r.id === Number(roundId));
    const isRoundEnded = currentRound ? (currentRound.status === 'results_published' || currentRound.status === 'closed') : false;

    const { socket, isConnected } = useAdminSocket({ eventId: event.id, roundId });

    useEffect(() => {
        if (!socket) return;

        const handleTeamRegistered = (data: any) => {
            // Only alert if we are in the general teams tab or round 1 teams tab
            // The user wanted this for round 1
            const isRound1 = event.rounds?.find((r: any) => r.id === Number(roundId))?.roundNumber === 1;
            if (!roundId || isRound1) {
                enqueueSnackbar(`🎉 New team registered: ${data.teamName} (${data.trackName})`, { variant: "info" });
                queryClient.invalidateQueries({ queryKey: ['organizerTeams', event.id] });
            }
        };

        socket.on("team.registered", handleTeamRegistered);

        return () => {
            socket.off("team.registered", handleTeamRegistered);
        };
    }, [socket, event, roundId, queryClient]);



    // Update Team Status Mutation
    const updateStatusMutation = useMutation({
        mutationFn: async ({ teamId, status, reason }: { teamId: number, status: string, reason?: string }) => {
            return axiosClient.put(`/organizer/teams/${teamId}/status`, {
                status,
                reason
            });
        },
        onSuccess: () => {
            enqueueSnackbar('Team status updated successfully', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['organizerTeams', event.id] });
            setTeamToEliminate(null);
            setEliminationReason("");
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (error: any) => {
            enqueueSnackbar(error.response?.data?.message || 'Failed to update status', { variant: 'error' });
        }
    });



    const handleUpdateStatus = (teamId: number, status: string) => {
        if (status === 'rejected' || status === 'disqualified') {
            setTeamToEliminate(teamId);
            return;
        }
        updateStatusMutation.mutate({ teamId, status });
    };

    const confirmElimination = () => {
        if (!teamToEliminate) return;
        if (!eliminationReason.trim()) {
            enqueueSnackbar('Please provide a reason', { variant: 'warning' });
            return;
        }
        updateStatusMutation.mutate({ teamId: teamToEliminate, status: 'rejected', reason: eliminationReason });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <span className="px-2 py-1 bg-amber-500/10 text-amber-500 rounded-md text-xs font-semibold">Pending</span>;
            case 'approved': return <span className="px-2 py-1 bg-green-500/10 text-green-500 rounded-md text-xs font-semibold">Approved</span>;
            case 'rejected': return <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded-md text-xs font-semibold">Rejected</span>;
            case 'disqualified': return <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded-md text-xs font-semibold">Disqualified</span>;
            default: return <span className="px-2 py-1 bg-muted text-muted-foreground rounded-md text-xs font-semibold">{status}</span>;
        }
    };

    // Bulk Delete Mutation
    const bulkDeleteMutation = useMutation({
        mutationFn: async (teamIds: number[]) => {
            return axiosClient.post(`/organizer/teams/bulk-delete`, { teamIds });
        },
        onSuccess: () => {
            enqueueSnackbar('Teams deleted successfully', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['organizerTeams', event.id, selectedTrackId] });
            setSelectedTeamIds([]);
            setIsBulkDeleteOpen(false);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (error: any) => {
            enqueueSnackbar(error.response?.data?.message || 'Failed to delete teams', { variant: 'error' });
        }
    });

    // Bulk Status Mutation
    const bulkStatusMutation = useMutation({
        mutationFn: async ({ teamIds, status, reason }: { teamIds: number[], status: string, reason?: string }) => {
            return axiosClient.post(`/organizer/teams/bulk-status`, { teamIds, status, reason });
        },
        onSuccess: () => {
            enqueueSnackbar('Teams status updated successfully', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['organizerTeams', event.id] });
            setSelectedTeamIds([]);
            setIsBulkStatusOpen(false);
            setBulkStatusReason("");
        },
        onError: (error: any) => {
            enqueueSnackbar(error.response?.data?.message || 'Failed to update teams status', { variant: 'error' });
        }
    });

    const filteredTeams = teams; // Filtering is now done on the backend

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedTeamIds(filteredTeams.map((t: any) => t.id));
        } else {
            setSelectedTeamIds([]);
        }
    };

    const handleSelectTeam = (teamId: number, checked: boolean) => {
        if (checked) {
            setSelectedTeamIds(prev => [...prev, teamId]);
        } else {
            setSelectedTeamIds(prev => prev.filter(id => id !== teamId));
        }
    };

    // Update selected team from updated cache
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentTeamDetails = teams?.find((t: any) => t.id === selectedTeamForDetails?.id) || selectedTeamForDetails;
    
    // Check if the current round is the first round or not in a round context
    const isFirstRound = !roundId || event.rounds?.find((r: any) => r.id === Number(roundId))?.roundNumber === 1;

    return (
        <div className="bg-card border border-border rounded-xl flex flex-col min-h-[500px]">
            {/* Header & Controls */}
            <div className="p-6 border-b border-border flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="shrink-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">Team Management</h3>
                        {isConnected && (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider border border-green-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Live
                            </span>
                        )}
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">Review and approve teams registered for the tracks.</p>
                </div>
                
                <div className="flex flex-wrap items-center xl:justify-end gap-3 w-full">
                    {/* Bulk Actions Button */}
                    {selectedTeamIds.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 xl:border-r border-border xl:pr-3">
                            <Button 
                                variant="outline" 
                                size="sm"
                                className="border-green-500/30 text-green-500 hover:bg-green-500/10 flex items-center gap-2"
                                onClick={() => { setBulkActionType('approved'); setIsBulkStatusOpen(true); }}
                                disabled={isRoundEnded}
                            >
                                <CheckCircle className="h-4 w-4" />
                                Approve ({selectedTeamIds.length})
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm"
                                className="border-red-500/30 text-red-500 hover:bg-red-500/10 flex items-center gap-2"
                                onClick={() => { setBulkActionType('rejected'); setIsBulkStatusOpen(true); }}
                            >
                                <XCircle className="h-4 w-4" />
                                Reject ({selectedTeamIds.length})
                            </Button>
                            <Button 
                                variant="destructive" 
                                size="sm"
                                className="bg-red-500 hover:bg-red-600 text-white flex items-center gap-2"
                                onClick={() => setIsBulkDeleteOpen(true)}
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </Button>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border">
                            Total: <span className="font-bold text-foreground">{meta.total}</span>
                        </div>

                    {/* Unified Status Selector */}
                    <select 
                        value={selectedStatus} 
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="bg-background border border-border text-foreground text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                    >
                        <option value="all">All Statuses</option>
                        <optgroup label="Registration">
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="disqualified">Disqualified</option>
                        </optgroup>
                        {roundId && (
                            <optgroup label="Round Result">
                                <option value="round_advanced">Passed</option>
                                <option value="round_eliminated">Eliminated</option>
                                <option value="round_pending">Pending/Judging</option>
                            </optgroup>
                        )}
                    </select>

                    {/* Track Selector */}
                    <select 
                        value={selectedTrackId} 
                        onChange={(e) => setSelectedTrackId(e.target.value === "all" ? "all" : Number(e.target.value))}
                        className="bg-background border border-border text-foreground text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                    >
                        <option value="all">All Tracks</option>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {event.tracks?.map((track: any) => (
                            <option key={track.id} value={track.id}>{track.name}</option>
                        ))}
                    </select>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input 
                                type="text" 
                                placeholder="Search teams..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full sm:w-[200px]"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 p-0 overflow-x-auto">
                <table className="w-full text-sm text-left text-muted-foreground">
                    <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                        <tr>
                            <th className="px-6 py-4 font-semibold w-12 text-center">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-border"
                                    checked={filteredTeams.length > 0 && selectedTeamIds.length === filteredTeams.length}
                                    onChange={handleSelectAll}
                                />
                            </th>
                            <th className="px-6 py-4 font-semibold w-16">#</th>
                            <th className="px-6 py-4 font-semibold">Team Name</th>
                            <th className="px-6 py-4 font-semibold">Leader</th>
                            <th className="px-6 py-4 font-semibold">Members</th>
                            <th className="px-6 py-4 font-semibold">Mentor</th>
                            <th className="px-6 py-4 font-semibold">Registered At</th>
                            <th className="px-6 py-4 font-semibold">Status</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={9} className="px-6 py-12 text-center">
                                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600"></div>
                                </td>
                            </tr>
                        ) : filteredTeams && filteredTeams.length > 0 ? (
                            filteredTeams.map((team: any, idx: number) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                                <tr key={team.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                                    <td className="px-6 py-4 text-center">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-border"
                                            checked={selectedTeamIds.includes(team.id)}
                                            onChange={(e) => handleSelectTeam(team.id, e.target.checked)}
                                        />
                                    </td>
                                    <td className="px-6 py-4 font-medium text-muted-foreground">
                                        {(meta.page - 1) * meta.limit + idx + 1}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-foreground">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span>{team.name}</span>
                                            {roundId && team.teamRounds && (
                                                (() => {
                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    const tr = team.teamRounds.find((r: any) => r.roundId === Number(roundId));
                                                    if (tr?.status === 'advanced') {
                                                        return <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[10px] font-bold border border-emerald-500/20 whitespace-nowrap">PASSED</span>
                                                    }
                                                    if (tr?.status === 'eliminated') {
                                                        return <span className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[10px] font-bold border border-red-500/20 whitespace-nowrap">ELIMINATED</span>
                                                    }
                                                    return null;
                                                })()
                                            )}
                                        </div>
                                        {selectedTrackId === "all" && team.track && (
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{team.track.name}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {team.leader?.name || team.leader?.email}
                                    </td>
                                    <td className="px-6 py-4">
                                        {team.members?.filter((m: any) => m.status === 'accepted' || m.role === 'leader').length || 0} / {team.track?.maxMembersPerTeam || '∞'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {team.mentorAssignments && team.mentorAssignments.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {team.mentorAssignments.map((ma: any) => (
                                                    <span key={ma.mentorId} className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded text-xs font-semibold whitespace-nowrap">
                                                        {ma.mentor?.name || 'Unknown'}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="px-2 py-1 bg-muted border border-border text-muted-foreground rounded text-xs font-medium whitespace-nowrap">
                                                Unassigned
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {team.createdAt ? new Date(team.createdAt).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(team.status)}
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="text-blue-500 hover:bg-blue-500/10 hover:text-blue-600 px-2"
                                            onClick={() => setSelectedTeamForDetails(team)}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        {team.status === 'pending' && !isRoundEnded && (
                                            <>
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    className="border-green-500/30 text-green-500 hover:bg-green-500/10"
                                                    onClick={() => handleUpdateStatus(team.id, 'approved')}
                                                    disabled={updateStatusMutation.isPending}
                                                >
                                                    <CheckCircle className="h-4 w-4 mr-1" /> Approve
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                                                    onClick={() => handleUpdateStatus(team.id, 'rejected')}
                                                    disabled={updateStatusMutation.isPending}
                                                >
                                                    <XCircle className="h-4 w-4 mr-1" /> Reject
                                                </Button>
                                            </>
                                        )}
                                        {team.status === 'approved' && (
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                                                onClick={() => handleUpdateStatus(team.id, 'disqualified')}
                                                disabled={updateStatusMutation.isPending}
                                            >
                                                <Trash2 className="h-4 w-4 mr-1" /> Disqualify
                                            </Button>
                                        )}
                                        {(team.status === 'rejected' || team.status === 'disqualified') && (
                                            <span className="text-xs text-muted-foreground italic max-w-[150px] inline-block truncate" title={team.eliminationReason}>
                                                {team.eliminationReason || 'No reason provided'}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                                    No teams found matching your filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {!isLoading && meta.total > 0 && (
                <div className="p-4 border-t border-border flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                        Showing <span className="font-semibold text-foreground">{(meta.page - 1) * meta.limit + 1}</span> to <span className="font-semibold text-foreground">{Math.min(meta.page * meta.limit, meta.total)}</span> of <span className="font-semibold text-foreground">{meta.total}</span> teams
                    </span>
                    {meta.totalPages > 1 && (
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                disabled={page === 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                            </Button>
                            <div className="text-sm font-medium px-2 flex items-center">
                                Page {page} / {meta.totalPages}
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                disabled={page === meta.totalPages}
                                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                            >
                                Next <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Elimination Modal */}
            {teamToEliminate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-card border border-border p-6 rounded-2xl w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold text-foreground mb-2">Reject / Disqualify Team</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Please provide a reason for rejecting or disqualifying this team. This reason will be recorded and potentially visible to the team.
                        </p>
                        <textarea
                            className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500/50 focus:border-red-500 outline-none mb-4 min-h-[100px]"
                            placeholder="Enter elimination reason..."
                            value={eliminationReason}
                            onChange={(e) => setEliminationReason(e.target.value)}
                        />
                        <div className="flex justify-end gap-3">
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    setTeamToEliminate(null);
                                    setEliminationReason("");
                                }}
                            >
                                Cancel
                            </Button>
                            <Button 
                                className="bg-red-500 hover:bg-red-600 text-white"
                                onClick={confirmElimination}
                                disabled={updateStatusMutation.isPending || !eliminationReason.trim()}
                            >
                                {updateStatusMutation.isPending ? 'Processing...' : 'Confirm Action'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Team Details Dialog Extracted */}
            <TeamDetailsDialog
                isOpen={!!selectedTeamForDetails}
                onClose={() => setSelectedTeamForDetails(null)}
                team={currentTeamDetails}
                eventId={event.id}
                showRejected={isFirstRound}
            />

            {/* Bulk Delete Confirmation Dialog */}
            <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Bulk Deletion</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete {selectedTeamIds.length} team(s)? This action will permanently remove these teams, their members, and all submissions.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="bg-muted/50 p-3 rounded-md max-h-[150px] overflow-y-auto text-foreground text-sm mt-4">
                        <ul className="list-disc pl-4 space-y-1">
                            {teams?.filter((t: any) => selectedTeamIds.includes(t.id)).map((team: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                                <li key={team.id}>
                                    <span className="font-semibold">{team.name}</span>
                                    {team.track && <span className="text-muted-foreground ml-1">({team.track.name})</span>}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                        <Button variant="ghost" onClick={() => setIsBulkDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={() => bulkDeleteMutation.mutate(selectedTeamIds)}
                            disabled={bulkDeleteMutation.isPending}
                        >
                            {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Bulk Status Confirmation Dialog */}
            <Dialog open={isBulkStatusOpen} onOpenChange={setIsBulkStatusOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Bulk {bulkActionType === 'approved' ? 'Approval' : 'Rejection'}</DialogTitle>
                        <DialogDescription>
                            You are about to mark {selectedTeamIds.length} team(s) as {bulkActionType}.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {bulkActionType === 'rejected' && (
                        <div className="mt-4">
                            <label className="text-sm font-medium text-foreground mb-1 block">Reason for Rejection *</label>
                            <textarea
                                className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500/50 focus:border-red-500 outline-none min-h-[80px]"
                                placeholder="Enter reason for rejecting these teams..."
                                value={bulkStatusReason}
                                onChange={(e) => setBulkStatusReason(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-3 mt-4">
                        <Button variant="ghost" onClick={() => { setIsBulkStatusOpen(false); setBulkStatusReason(""); }}>
                            Cancel
                        </Button>
                        <Button 
                            className={bulkActionType === 'approved' ? "bg-green-500 hover:bg-green-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"}
                            onClick={() => bulkStatusMutation.mutate({ teamIds: selectedTeamIds, status: bulkActionType, reason: bulkStatusReason })}
                            disabled={bulkStatusMutation.isPending || (bulkActionType === 'rejected' && !bulkStatusReason.trim())}
                        >
                            {bulkStatusMutation.isPending ? "Processing..." : "Confirm Action"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
