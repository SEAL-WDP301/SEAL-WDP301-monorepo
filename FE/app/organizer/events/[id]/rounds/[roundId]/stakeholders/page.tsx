"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { useParams } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Plus, GraduationCap, Trash2, Loader2, Search, Target, LayoutDashboard, ChevronRight, Eye } from "lucide-react";
import { TeamDetailsDialog } from "../../../components/team-details-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { enqueueSnackbar } from "notistack";

export default function EventStakeholdersPage() {
  const params = useParams();
  const eventId = params.id as string;
  const roundId = params.roundId as string;
  const queryClient = useQueryClient();

  // Modals state
  const [isJudgeModalOpen, setIsJudgeModalOpen] = useState(false);
  const [isMentorModalOpen, setIsMentorModalOpen] = useState(false);
  const [drawerUser, setDrawerUser] = useState<any>(null);

  // Form state
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<number | "">("");
  const [selectedTrackIds, setSelectedTrackIds] = useState<number[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [selectedTeamIdForDetails, setSelectedTeamIdForDetails] = useState<number | null>(null);

  // Queries
  const { data: event } = useQuery({
    queryKey: ["organizerEvent", eventId],
    queryFn: async () => {
      const res = await axiosClient.get(`/public/events/${eventId}`);
      return res.data.data;
    },
  });

  const { data: stakeholders, isLoading: isLoadingStaff } = useQuery({
    queryKey: ["organizerStakeholders", eventId],
    queryFn: async () => {
      const res = await axiosClient.get(`/organizer/assignments/events/${eventId}`);
      return res.data.data;
    },
    enabled: !!eventId,
  });

  const { data: teams } = useQuery({
    queryKey: ["organizerTeams", eventId],
    queryFn: async () => {
      const res = await axiosClient.get(`/organizer/teams/events/${eventId}`);
      return res.data.data;
    },
  });

  // Categorize stakeholders based on current round
  const mentors = stakeholders?.filter((s: any) => 
    s.mentorAssignments?.some((ma: any) => ma.team?.teamRounds?.some((tr: any) => tr.roundId === Number(roundId)))
  ) || [];
  const judges = stakeholders?.filter((s: any) => 
    s.judgeAssignments?.some((ja: any) => ja.roundId === Number(roundId))
  ) || [];
  const available = stakeholders?.filter((s: any) => 
    !s.mentorAssignments?.some((ma: any) => ma.team?.teamRounds?.some((tr: any) => tr.roundId === Number(roundId))) && 
    !s.judgeAssignments?.some((ja: any) => ja.roundId === Number(roundId))
  ) || [];

  // Filter for search inside modal
  const filteredModalUsers = stakeholders?.filter((u: any) => 
    u.name?.toLowerCase().includes(modalSearchQuery.toLowerCase()) || 
    u.email?.toLowerCase().includes(modalSearchQuery.toLowerCase())
  ) || [];

  const roundObj = event?.rounds?.find((r: any) => r.id === Number(roundId));

  // Mutations
  const assignJudgeMutation = useMutation({
    mutationFn: async (data: { stakeholderIds: number[], roundId: number, trackIds?: number[] }) => {
      const res = await axiosClient.post(`/organizer/assignments/events/${eventId}/judges`, data);
      return res.data;
    },
    onSuccess: () => {
      enqueueSnackbar('Judges assigned successfully', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ["organizerStakeholders", eventId] });
      setIsJudgeModalOpen(false);
      resetForms();
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Failed to assign judge', { variant: 'error' });
    }
  });

  const unassignJudgeMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      const res = await axiosClient.delete(`/organizer/assignments/judges/${assignmentId}`);
      return res.data;
    },
    onSuccess: (_data, assignmentId) => {
      enqueueSnackbar('Judge unassigned successfully', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ["organizerStakeholders", eventId] });
      if (drawerUser) {
          const updatedUser = { ...drawerUser, judgeAssignments: drawerUser.judgeAssignments.filter((ja: any) => ja.id !== assignmentId) };
          setDrawerUser(updatedUser);
      }
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Failed to unassign judge', { variant: 'error' });
    }
  });

  const assignMentorMutation = useMutation({
    mutationFn: async (data: { stakeholderId: number, teamIds: number[] }) => {
      const res = await axiosClient.post(`/organizer/assignments/events/${eventId}/mentors/bulk-assign`, data);
      return res.data;
    },
    onSuccess: () => {
      enqueueSnackbar('Mentor assigned successfully', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ["organizerStakeholders", eventId] });
      queryClient.invalidateQueries({ queryKey: ["organizerTeams", eventId] });
      setIsMentorModalOpen(false);
      resetForms();
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Failed to assign mentor', { variant: 'error' });
    }
  });

  const unassignMentorMutation = useMutation({
    mutationFn: async (data: { teamId: number; stakeholderId: number }) => {
      const res = await axiosClient.delete(`/organizer/assignments/teams/${data.teamId}/mentors/${data.stakeholderId}`);
      return res.data;
    },
    onSuccess: (data, variables) => {
      enqueueSnackbar('Mentor unassigned successfully', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ["organizerStakeholders", eventId] });
      queryClient.invalidateQueries({ queryKey: ["organizerTeams", eventId] });
      if (drawerUser) {
        const updatedUser = { ...drawerUser, mentorAssignments: drawerUser.mentorAssignments.filter((ma: any) => ma.teamId !== variables.teamId) };
        setDrawerUser(updatedUser);
      }
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Failed to unassign mentor', { variant: 'error' });
    }
  });

  const resetForms = () => {
    setSelectedUser(null);
    setSelectedUsers([]);
    setSelectedTrack("");
    setSelectedTrackIds([]);
    setSelectedTeamIds([]);
    setModalSearchQuery("");
  };

  const handleAssignJudge = () => {
    if (selectedUsers.length === 0) return;
    assignJudgeMutation.mutate({
      stakeholderIds: selectedUsers,
      roundId: Number(roundId),
      trackIds: roundObj?.isTrackSpecific ? selectedTrackIds : [],
    });
  };

  const handleAssignMentor = () => {
    if (!selectedUser || selectedTeamIds.length === 0) return;
    assignMentorMutation.mutate({
      stakeholderId: selectedUser,
      teamIds: selectedTeamIds,
    });
  };

  const filteredTeams = teams?.filter((t: any) => 
    t.trackId === selectedTrack && 
    t.status === 'approved' && 
    t.teamRounds?.some((tr: any) => tr.roundId === Number(roundId)) &&
    (!t.mentorAssignments || t.mentorAssignments.length === 0)
  ) || [];

  const currentTeamDetails = teams?.find((t: any) => t.id === selectedTeamIdForDetails);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mentors & Judges</h1>
          <p className="text-muted-foreground mt-1">
            Manage your event's professional stakeholders, assign mentors to teams and judges to rounds.
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            className="gap-2 bg-amber-600 hover:bg-amber-700"
            onClick={() => { resetForms(); setIsMentorModalOpen(true); }}
          >
            <Plus className="h-4 w-4" />
            Assign Mentor
          </Button>
          <Button 
            className="gap-2 bg-blue-600 hover:bg-blue-700"
            onClick={() => { resetForms(); setIsJudgeModalOpen(true); }}
          >
            <Plus className="h-4 w-4" />
            Assign Judge
          </Button>
        </div>
      </div>

      <GlassCard className="p-6 rounded-[24px]">
        <Tabs defaultValue="mentors" className="w-full">
          <TabsList className="mb-6 bg-muted/50 p-1 w-full max-w-md grid grid-cols-3">
            <TabsTrigger value="mentors">Mentors ({mentors.length})</TabsTrigger>
            <TabsTrigger value="judges">Judges ({judges.length})</TabsTrigger>
            <TabsTrigger value="available">Available ({available.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="mentors">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-semibold">User</th>
                    <th className="px-6 py-4 font-semibold">Job Title & Org</th>
                    <th className="px-6 py-4 font-semibold">Assigned Teams</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingStaff ? (
                    <tr><td colSpan={4} className="px-6 py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" /></td></tr>
                  ) : mentors.length > 0 ? mentors.map((user: any) => (
                    <tr key={user.id} className="border-b border-border hover:bg-muted/10">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-foreground">{user.stakeholderProfile?.jobTitle || "N/A"}</div>
                        <div className="text-xs text-muted-foreground">{user.stakeholderProfile?.organization || "N/A"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-amber-500">{user.mentorAssignments.length}</span> teams
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDrawerUser(user)}>
                          Details <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No mentors found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="judges">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-semibold">User</th>
                    <th className="px-6 py-4 font-semibold">Job Title & Org</th>
                    <th className="px-6 py-4 font-semibold">Assigned Rounds</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingStaff ? (
                    <tr><td colSpan={4} className="px-6 py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" /></td></tr>
                  ) : judges.length > 0 ? judges.map((user: any) => (
                    <tr key={user.id} className="border-b border-border hover:bg-muted/10">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-foreground">{user.stakeholderProfile?.jobTitle || "N/A"}</div>
                        <div className="text-xs text-muted-foreground">{user.stakeholderProfile?.organization || "N/A"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-blue-500">{user.judgeAssignments.length}</span> assignments
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDrawerUser(user)}>
                          Details <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No judges found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="available">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-semibold">User</th>
                    <th className="px-6 py-4 font-semibold">Job Title & Org</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingStaff ? (
                    <tr><td colSpan={3} className="px-6 py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" /></td></tr>
                  ) : available.length > 0 ? available.map((user: any) => (
                    <tr key={user.id} className="border-b border-border hover:bg-muted/10">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-foreground">{user.stakeholderProfile?.jobTitle || "N/A"}</div>
                        <div className="text-xs text-muted-foreground">{user.stakeholderProfile?.organization || "N/A"}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDrawerUser(user)}>
                          View Profile <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="px-6 py-12 text-center text-muted-foreground">No available stakeholders.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </GlassCard>

      {/* Drawer for Details */}
      <Sheet open={!!drawerUser} onOpenChange={(open) => !open && setDrawerUser(null)}>
        <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto bg-card border-l border-border p-6">
          <SheetHeader className="mb-6 flex flex-row items-center gap-4">
            {drawerUser?.avatarUrl ? (
              <img src={drawerUser.avatarUrl} alt={drawerUser.name} className="w-16 h-16 rounded-full border-2 border-border object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground border-2 border-border">
                {drawerUser?.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex flex-col text-left">
              <SheetTitle className="text-2xl mt-0">{drawerUser?.name}</SheetTitle>
              <SheetDescription>{drawerUser?.email}</SheetDescription>
            </div>
          </SheetHeader>
          
          <div className="space-y-6">
            {/* Profile Info */}
            <div className="bg-muted/30 p-4 rounded-xl border border-border">
              <h3 className="font-semibold mb-2">Professional Profile</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Job Title:</span> {drawerUser?.stakeholderProfile?.jobTitle}</p>
                <p><span className="text-muted-foreground">Organization:</span> {drawerUser?.stakeholderProfile?.organization}</p>
                <p><span className="text-muted-foreground">Experience:</span> {drawerUser?.stakeholderProfile?.experience}</p>
                <p><span className="text-muted-foreground">Bio:</span> {drawerUser?.stakeholderProfile?.bio}</p>
              </div>
            </div>

            {/* Mentor Assignments */}
            {drawerUser?.mentorAssignments?.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-500" /> Mentored Teams
                </h3>
                <div className="space-y-2">
                  {drawerUser.mentorAssignments.map((ma: any) => (
                    <div key={ma.id} className="flex items-center justify-between bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                      <div>
                        <p className="font-medium">{ma.team?.name}</p>
                        <p className="text-xs text-muted-foreground">Track: {ma.team?.track?.name}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" size="sm" className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                          onClick={() => setSelectedTeamIdForDetails(ma.teamId)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => unassignMentorMutation.mutate({ stakeholderId: drawerUser.id, teamId: ma.teamId })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Judge Assignments */}
            {drawerUser?.judgeAssignments?.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4 text-blue-500" /> Judge Assignments
                </h3>
                <div className="space-y-2">
                  {drawerUser.judgeAssignments.map((ja: any) => (
                    <div key={ja.id} className="flex items-center justify-between bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
                      <div>
                        <p className="font-medium">Round: {ja.round?.name}</p>
                        <p className="text-xs text-muted-foreground">{ja.track ? `Track: ${ja.track.name}` : 'All Tracks'}</p>
                      </div>
                      <Button 
                        variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => unassignJudgeMutation.mutate(ja.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Assign Judge Modal */}
      <Dialog open={isJudgeModalOpen} onOpenChange={setIsJudgeModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Assign Judge</DialogTitle>
            <DialogDescription>Assign a stakeholder to judge a specific round.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Select Stakeholders</label>
              <div className="space-y-2 border border-border rounded-lg p-2">
                <input 
                  type="text" 
                  placeholder="Search by name or email..." 
                  className="w-full bg-muted/30 border border-border rounded p-2 text-sm mb-2 outline-none focus:border-blue-500"
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                />
                <div className="max-h-[150px] overflow-y-auto space-y-1">
                  <label className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded cursor-pointer border-b border-border mb-1 pb-2">
                    <input 
                      type="checkbox" 
                      className="rounded border-border bg-background"
                      checked={
                        filteredModalUsers?.filter((u: any) => !(u.mentorAssignments && u.mentorAssignments.length > 0)).length > 0 &&
                        selectedUsers.length === filteredModalUsers?.filter((u: any) => !(u.mentorAssignments && u.mentorAssignments.length > 0)).length
                      }
                      onChange={(e) => {
                        const selectable = filteredModalUsers?.filter((u: any) => !(u.mentorAssignments && u.mentorAssignments.length > 0)).map((u: any) => u.id) || [];
                        if (e.target.checked) setSelectedUsers(selectable);
                        else setSelectedUsers([]);
                      }}
                    />
                    <span className="text-sm font-semibold">Select All (Active Stakeholders)</span>
                  </label>
                  {filteredModalUsers?.map((u: any) => {
                    const isMentor = u.mentorAssignments && u.mentorAssignments.length > 0;
                    return (
                      <label 
                        key={u.id} 
                        className={`flex items-center space-x-2 p-1 rounded transition-colors ${
                          isMentor 
                            ? "opacity-50 cursor-not-allowed bg-muted/20" 
                            : "hover:bg-muted/50 cursor-pointer"
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          disabled={isMentor}
                          className="rounded border-border bg-background disabled:opacity-50 disabled:cursor-not-allowed"
                          checked={selectedUsers.includes(u.id)}
                          onChange={(e) => {
                            if (isMentor) return;
                            if (e.target.checked) setSelectedUsers([...selectedUsers, u.id]);
                            else setSelectedUsers(selectedUsers.filter(id => id !== u.id));
                          }}
                        />
                        <span className="text-sm flex items-center justify-between w-full pr-2">
                          <span>{u.name} <span className="text-muted-foreground text-xs">({u.email})</span></span>
                          {isMentor && (
                            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              Mentor
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                  {filteredModalUsers?.length === 0 && (
                    <div className="text-sm text-muted-foreground p-2 text-center">No stakeholders found.</div>
                  )}
                </div>
              </div>
            </div>

            {roundObj && roundObj.isTrackSpecific && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Select Tracks (Required)</label>
                <div className="space-y-2 max-h-[150px] overflow-y-auto border border-border rounded-lg p-2">
                  {event?.tracks?.map((track: any) => (
                    <label key={track.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="rounded border-border bg-background"
                        checked={selectedTrackIds.includes(track.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTrackIds([...selectedTrackIds, track.id]);
                          else setSelectedTrackIds(selectedTrackIds.filter(id => id !== track.id));
                        }}
                      />
                      <span className="text-sm">{track.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setIsJudgeModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAssignJudge} disabled={selectedUsers.length === 0 || assignJudgeMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {assignJudgeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Assign ${selectedUsers.length > 0 ? selectedUsers.length : ''} Judges to ${roundObj?.name || 'Round'}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Mentor Modal */}
      <Dialog open={isMentorModalOpen} onOpenChange={setIsMentorModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Assign Mentor</DialogTitle>
            <DialogDescription>Bulk assign a mentor to teams within a track.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Select Stakeholder</label>
              <input 
                type="text" 
                placeholder="Search by name or email..." 
                className="w-full bg-background border border-border rounded-lg p-2.5 text-sm mb-2 outline-none focus:border-blue-500"
                value={modalSearchQuery}
                onChange={(e) => setModalSearchQuery(e.target.value)}
              />
              <select
                value={selectedUser || ""}
                onChange={(e) => setSelectedUser(Number(e.target.value))}
                className="w-full bg-background border border-border text-foreground text-sm rounded-lg p-2.5"
              >
                <option value="">Choose...</option>
                {filteredModalUsers?.map((u: any) => {
                  const isJudge = u.judgeAssignments && u.judgeAssignments.length > 0;
                  return (
                    <option key={u.id} value={u.id} disabled={isJudge}>
                      {u.name} ({u.email}){isJudge ? " — (Judge - Cannot be Mentor)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
               <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Filter by Track</label>
               <select
                value={selectedTrack}
                onChange={(e) => { setSelectedTrack(Number(e.target.value)); setSelectedTeamIds([]); }}
                className="w-full bg-background border border-border text-foreground text-sm rounded-lg p-2.5"
               >
                 <option value="">Select a track...</option>
                 {event?.tracks?.map((track: any) => {
                   const availableCount = teams?.filter((t: any) => 
                     t.trackId === track.id && 
                     t.status === 'approved' && 
                     (!t.mentorAssignments || t.mentorAssignments.length === 0)
                   ).length || 0;
                   return (
                     <option key={track.id} value={track.id} disabled={availableCount === 0}>
                       {track.name} {availableCount === 0 ? "(No teams available)" : `(${availableCount} available)`}
                     </option>
                   );
                 })}
               </select>
            </div>

            {selectedTrack !== "" && (
              <div>
                <label className="text-xs font-semibold flex justify-between text-muted-foreground uppercase mb-1">
                  <span>Select Teams</span>
                  <button 
                    type="button" 
                    className="text-blue-500 hover:underline"
                    onClick={() => {
                      if (selectedTeamIds.length === filteredTeams.length) setSelectedTeamIds([]);
                      else setSelectedTeamIds(filteredTeams.map((t: any) => t.id));
                    }}
                  >
                    Select All
                  </button>
                </label>
                <div className="mb-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-2.5 text-xs text-blue-600 dark:text-blue-400">
                  Only <strong>approved teams</strong> that do not currently have an assigned mentor are shown here.
                </div>
                <div className="space-y-2 max-h-[150px] overflow-y-auto border border-border rounded-lg p-2">
                  {filteredTeams.length === 0 && <p className="text-sm text-muted-foreground p-2">No satisfying teams in this track.</p>}
                  {filteredTeams.map((team: any) => (
                    <label key={team.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="rounded border-border bg-background"
                        checked={selectedTeamIds.includes(team.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTeamIds([...selectedTeamIds, team.id]);
                          else setSelectedTeamIds(selectedTeamIds.filter(id => id !== team.id));
                        }}
                      />
                      <span className="text-sm">{team.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setIsMentorModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAssignMentor} disabled={!selectedUser || selectedTeamIds.length === 0 || assignMentorMutation.isPending} className="bg-amber-600 hover:bg-amber-700">
                {assignMentorMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign Mentor"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TeamDetailsDialog 
        isOpen={!!selectedTeamIdForDetails}
        onClose={() => setSelectedTeamIdForDetails(null)}
        team={currentTeamDetails}
        eventId={eventId}
      />
    </div>
  );
}
