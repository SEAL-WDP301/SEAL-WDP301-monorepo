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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { enqueueSnackbar } from "notistack";

type RoundTrack = {
  id: number;
  name: string;
};

type RoundTeam = {
  id: number;
  name: string;
  status: string;
  trackId: number | null;
  track?: RoundTrack | null;
  mentorAssignments?: Array<{
    id?: number;
    mentor?: { id?: number; name?: string; email?: string };
  }>;
};

type RoundConfig = {
  isTrackSpecific?: boolean;
  trackProblems?: Array<{ trackId: number }>;
};

function resolveRoundTracksForAssignment(
  roundObj: RoundConfig | undefined,
  event: { tracks?: RoundTrack[]; deferredTrackAssignment?: boolean } | undefined,
  teams: RoundTeam[],
): RoundTrack[] {
  const catalog = event?.tracks ?? [];
  if (!roundObj) return [];

  if (roundObj.isTrackSpecific) {
    const scopedIds = new Set(
      (roundObj.trackProblems ?? []).map((problem) => problem.trackId),
    );
    if (scopedIds.size > 0) {
      return catalog
        .filter((track) => scopedIds.has(track.id))
        .sort((first, second) => first.name.localeCompare(second.name));
    }
  } else if (event?.deferredTrackAssignment) {
    return [...catalog].sort((first, second) =>
      first.name.localeCompare(second.name),
    );
  }

  return Array.from(
    new Map(
      teams
        .filter(
          (team): team is RoundTeam & { trackId: number; track: RoundTrack } =>
            team.trackId !== null && Boolean(team.track),
        )
        .map((team) => [team.trackId, team.track] as const),
    ).values(),
  ).sort((first, second) => first.name.localeCompare(second.name));
}

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
  const [selectedTrackIds, setSelectedTrackIds] = useState<number[]>([]);
  const [selectedMentorTrackId, setSelectedMentorTrackId] = useState<
    number | null
  >(null);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [selectedTeamIdForDetails, setSelectedTeamIdForDetails] = useState<number | null>(null);
  const [dualRoleConfirm, setDualRoleConfirm] = useState<null | {
    kind: "judge" | "mentor";
    names: string[];
  }>(null);

  // Queries — organizer API (public hides tracks/problem statements for deferred events).
  const { data: event } = useQuery({
    queryKey: ["organizerEvent", eventId],
    queryFn: async () => {
      const res = await axiosClient.get(`/organizer/events/${eventId}`);
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

  const { data: teams = [] } = useQuery<RoundTeam[]>({
    queryKey: ["organizerTeams", eventId, "stakeholder-assignment", roundId],
    queryFn: async () => {
      const res = await axiosClient.get(`/organizer/teams/events/${eventId}`, {
        params: { roundId, limit: 1000 },
      });
      return res.data.data;
    },
    enabled: Boolean(eventId && roundId),
  });

  const {
    data: mentorAvailableTeams = [],
    isFetching: isFetchingMentorTeams,
    isError: isMentorTeamsError,
  } = useQuery<RoundTeam[]>({
    queryKey: [
      "organizerTeams",
      eventId,
      "mentor-track-assignment",
      roundId,
    ],
    queryFn: async () => {
      const res = await axiosClient.get(`/organizer/teams/events/${eventId}`, {
        params: {
          roundId,
          status: "approved",
          limit: 1000,
        },
      });
      return res.data.data;
    },
    enabled: isMentorModalOpen,
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
  const requireJudgeTracks =
    Boolean(roundObj?.isTrackSpecific) ||
    Boolean(event?.deferredTrackAssignment);
  const roundTracks = resolveRoundTracksForAssignment(roundObj, event, teams);
  const selectedMentorTrackName =
    selectedMentorTrackId === null
      ? "All Tracks"
      : roundTracks.find((track) => track.id === selectedMentorTrackId)?.name ??
        "Select Track";
  const filteredMentorTeams = mentorAvailableTeams.filter(
    (team) =>
      (selectedMentorTrackId === null ||
        team.trackId === selectedMentorTrackId) &&
      team.status === "approved",
  );
  const selectableMentorTeams = filteredMentorTeams.filter(
    (team) => !team.mentorAssignments || team.mentorAssignments.length === 0,
  );
  const areAllRoundTracksSelected =
    roundTracks.length > 0 &&
    roundTracks.every((track) => selectedTrackIds.includes(track.id));
  const areAllMentorTeamsSelected =
    selectableMentorTeams.length > 0 &&
    selectableMentorTeams.every((team) =>
      selectedTeamIds.includes(team.id),
    );

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
    setSelectedTrackIds([]);
    setSelectedMentorTrackId(null);
    setSelectedTeamIds([]);
    setModalSearchQuery("");
  };

  const selectMentorTrack = (trackId: number | null) => {
    if (trackId === selectedMentorTrackId) return;
    void queryClient.invalidateQueries({
      queryKey: [
        "organizerTeams",
        eventId,
        "mentor-track-assignment",
        roundId,
        trackId ?? "all",
      ],
      exact: true,
    });
    setSelectedMentorTrackId(trackId);
    setSelectedTeamIds([]);
  };

  const doAssignJudge = () => {
    assignJudgeMutation.mutate({
      stakeholderIds: selectedUsers,
      roundId: Number(roundId),
      trackIds: requireJudgeTracks ? selectedTrackIds : undefined,
    });
  };

  const doAssignMentor = () => {
    if (!selectedUser) return;
    assignMentorMutation.mutate({
      stakeholderId: selectedUser,
      teamIds: selectedTeamIds,
    });
  };

  const handleAssignJudge = () => {
    if (selectedUsers.length === 0) return;
    if (requireJudgeTracks && selectedTrackIds.length === 0) {
      enqueueSnackbar("Select at least one track for this round.", {
        variant: "warning",
      });
      return;
    }
    const alreadyMentors = (stakeholders || []).filter(
      (u: any) =>
        selectedUsers.includes(u.id) &&
        u.mentorAssignments &&
        u.mentorAssignments.length > 0,
    );
    if (alreadyMentors.length > 0) {
      setDualRoleConfirm({
        kind: "judge",
        names: alreadyMentors.map((u: any) => u.name),
      });
      return;
    }
    doAssignJudge();
  };

  const handleAssignMentor = () => {
    if (!selectedUser || selectedTeamIds.length === 0) return;
    const user = (stakeholders || []).find((u: any) => u.id === selectedUser);
    const alreadyJudge =
      user?.judgeAssignments && user.judgeAssignments.length > 0;
    if (alreadyJudge) {
      setDualRoleConfirm({
        kind: "mentor",
        names: [user.name],
      });
      return;
    }
    doAssignMentor();
  };

  const currentTeamDetails = teams.find((team) => team.id === selectedTeamIdForDetails);

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
            <TabsTrigger value="available">Unassigned ({available.length})</TabsTrigger>
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
                        <div className="flex flex-wrap items-center gap-2">
                          <span>
                            <span className="font-semibold text-amber-500">{user.mentorAssignments.length}</span> teams
                          </span>
                          {user.judgeAssignments?.some((ja: any) => ja.roundId === Number(roundId)) && (
                            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                              Also judge
                            </span>
                          )}
                        </div>
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
                    <th className="px-6 py-4 font-semibold">This round</th>
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
                        <div className="flex flex-wrap items-center gap-2">
                          <span>
                            <span className="font-semibold text-blue-500">
                              {
                                (user.judgeAssignments || []).filter(
                                  (ja: any) => ja.roundId === Number(roundId),
                                ).length
                              }
                            </span>{" "}
                            assignments
                          </span>
                          {user.mentorAssignments?.some((ma: any) =>
                            ma.team?.teamRounds?.some((tr: any) => tr.roundId === Number(roundId)),
                          ) && (
                            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              Also mentor
                            </span>
                          )}
                        </div>
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
            <p className="mb-4 text-sm text-muted-foreground">
              Stakeholders with no mentor/judge role in this round yet. Mentors can still be assigned as judges (and vice versa) via{" "}
              <strong>Assign Mentor</strong> / <strong>Assign Judge</strong>.
            </p>
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
        <SheetContent className="!w-full sm:!max-w-[540px] md:!max-w-[580px] overflow-y-auto bg-card border-l border-border/80 p-6 sm:p-7">
          <SheetHeader className="mb-6 flex flex-row items-center gap-4 border-b border-border/60 pb-6">
            {drawerUser?.avatarUrl ? (
              <img src={drawerUser.avatarUrl} alt={drawerUser.name} className="w-16 h-16 rounded-full border-2 border-primary/20 object-cover shadow-sm" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold border-2 border-primary/20 shadow-sm">
                {drawerUser?.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex flex-col text-left min-w-0 flex-1">
              <SheetTitle className="text-2xl font-bold tracking-tight text-foreground">{drawerUser?.name}</SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">{drawerUser?.email}</SheetDescription>
            </div>
          </SheetHeader>

          <div className="space-y-6">
            {/* Profile Info */}
            <div className="bg-muted/30 p-5 sm:p-6 rounded-2xl border border-border/80 space-y-4">
              <h3 className="text-base font-bold text-foreground border-b border-border/60 pb-2">
                Professional Profile
              </h3>
              <div className="space-y-3.5 text-sm leading-relaxed">
                {drawerUser?.stakeholderProfile?.jobTitle && (
                  <div>
                    <span className="font-semibold text-foreground">Job Title:</span>{" "}
                    <span className="text-muted-foreground">{drawerUser.stakeholderProfile.jobTitle}</span>
                  </div>
                )}
                {drawerUser?.stakeholderProfile?.organization && (
                  <div>
                    <span className="font-semibold text-foreground">Organization:</span>{" "}
                    <span className="text-muted-foreground">{drawerUser.stakeholderProfile.organization}</span>
                  </div>
                )}
                {drawerUser?.stakeholderProfile?.experience && (
                  <div>
                    <span className="font-semibold text-foreground block mb-1">Experience:</span>
                    <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed bg-background/50 p-3.5 rounded-xl border border-border/50">
                      {drawerUser.stakeholderProfile.experience}
                    </p>
                  </div>
                )}
                {drawerUser?.stakeholderProfile?.achievements && (
                  <div>
                    <span className="font-semibold text-foreground block mb-1">Key Achievements:</span>
                    <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed bg-background/50 p-3.5 rounded-xl border border-border/50">
                      {drawerUser.stakeholderProfile.achievements}
                    </p>
                  </div>
                )}
                {drawerUser?.stakeholderProfile?.bio && (
                  <div>
                    <span className="font-semibold text-foreground block mb-1">Bio:</span>
                    <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed bg-background/50 p-3.5 rounded-xl border border-border/50">
                      {drawerUser.stakeholderProfile.bio}
                    </p>
                  </div>
                )}
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

            {/* Judge Assignments — only this round */}
            {drawerUser?.judgeAssignments?.filter(
              (ja: any) => ja.roundId === Number(roundId),
            ).length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4 text-blue-500" /> Judge Assignments
                  <span className="text-xs font-normal text-muted-foreground">
                    (this round)
                  </span>
                </h3>
                <div className="space-y-2">
                  {drawerUser.judgeAssignments
                    .filter((ja: any) => ja.roundId === Number(roundId))
                    .map((ja: any) => (
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
              <p className="mb-2 text-xs text-muted-foreground">
                All stakeholders are selectable. Mentors can also be judges (they cannot score teams they mentor).
              </p>
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
                        filteredModalUsers.length > 0 &&
                        filteredModalUsers.every(
                          (user: (typeof filteredModalUsers)[number]) =>
                            selectedUsers.includes(user.id),
                        )
                      }
                      onChange={(e) => {
                        const selectable = filteredModalUsers.map(
                          (user: (typeof filteredModalUsers)[number]) => user.id,
                        );
                        if (e.target.checked) {
                          setSelectedUsers((current) => [
                            ...new Set([...current, ...selectable]),
                          ]);
                        } else {
                          setSelectedUsers((current) =>
                            current.filter((id) => !selectable.includes(id)),
                          );
                        }
                      }}
                    />
                    <span className="text-sm font-semibold">Select All (Active Stakeholders)</span>
                  </label>
                  {filteredModalUsers?.map((u: any) => {
                    const isMentor = u.mentorAssignments && u.mentorAssignments.length > 0;
                    const isJudgeHere = u.judgeAssignments?.some(
                      (ja: any) => ja.roundId === Number(roundId),
                    );
                    return (
                      <label
                        key={u.id}
                        className={`flex items-center space-x-2 rounded border p-2 transition-colors cursor-pointer ${
                          selectedUsers.includes(u.id)
                            ? "border-blue-500/40 bg-blue-500/10"
                            : "border-transparent hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-border bg-background"
                          checked={selectedUsers.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers((current) => [...current, u.id]);
                            } else {
                              setSelectedUsers((current) =>
                                current.filter((id) => id !== u.id),
                              );
                            }
                          }}
                        />
                        <span className="text-sm flex items-center justify-between w-full pr-2 gap-2">
                          <span>{u.name} <span className="text-muted-foreground text-xs">({u.email})</span></span>
                          <span className="flex shrink-0 gap-1">
                            {isMentor && (
                              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                Mentor
                              </span>
                            )}
                            {isJudgeHere && (
                              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                Judge
                              </span>
                            )}
                          </span>
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

            {requireJudgeTracks && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Select Tracks (Required)</label>
                <div className="space-y-2 max-h-[150px] overflow-y-auto border border-border rounded-lg p-2">
                  {roundTracks.length > 0 ? (
                    <>
                      <label
                        className={`flex cursor-pointer items-center space-x-2 rounded border p-2 ${
                          areAllRoundTracksSelected
                            ? "border-blue-500/40 bg-blue-500/10"
                            : "border-transparent hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-border bg-background"
                          checked={areAllRoundTracksSelected}
                          onChange={(e) => {
                            setSelectedTrackIds(
                              e.target.checked
                                ? roundTracks.map((track) => track.id)
                                : [],
                            );
                          }}
                        />
                        <span className="text-sm font-semibold">Select all tracks</span>
                      </label>
                      {roundTracks.map((track) => (
                        <label
                          key={track.id}
                          className={`flex cursor-pointer items-center space-x-2 rounded border p-2 ${
                            selectedTrackIds.includes(track.id)
                              ? "border-blue-500/40 bg-blue-500/10"
                              : "border-transparent hover:bg-muted/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="rounded border-border bg-background"
                            checked={selectedTrackIds.includes(track.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTrackIds((current) => [
                                  ...current,
                                  track.id,
                                ]);
                              } else {
                                setSelectedTrackIds((current) =>
                                  current.filter((id) => id !== track.id),
                                );
                              }
                            }}
                          />
                          <span className="text-sm">{track.name}</span>
                        </label>
                      ))}
                    </>
                  ) : (
                    <p className="p-2 text-sm text-muted-foreground">
                      No teams in this round have been assigned a track yet.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setIsJudgeModalOpen(false)}>Cancel</Button>
              <Button
                onClick={handleAssignJudge}
                disabled={
                  selectedUsers.length === 0 ||
                  assignJudgeMutation.isPending ||
                  (requireJudgeTracks && selectedTrackIds.length === 0)
                }
                className="bg-blue-600 hover:bg-blue-700"
              >
                {assignJudgeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Assign ${selectedUsers.length > 0 ? selectedUsers.length : ''} Judges to ${roundObj?.name || 'Round'}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Mentor Modal */}
      <Dialog open={isMentorModalOpen} onOpenChange={setIsMentorModalOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[500px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Assign Mentor</DialogTitle>
            <DialogDescription>Assign one mentor to approved teams in this round.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Select Stakeholder</label>
              <p className="mb-2 text-xs text-muted-foreground">
                All stakeholders are selectable, including current judges.
              </p>
              <div className="space-y-2 rounded-lg border border-border p-2">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  className="mb-2 w-full rounded border border-border bg-muted/30 p-2 text-sm outline-none focus:border-amber-500"
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                />
                <div className="max-h-[150px] space-y-1 overflow-y-auto">
                  {filteredModalUsers.map(
                    (user: (typeof filteredModalUsers)[number]) => {
                      const isJudge =
                        user.judgeAssignments &&
                        user.judgeAssignments.length > 0;
                      const isSelected = selectedUser === user.id;

                      return (
                        <label
                          key={user.id}
                          className={`flex cursor-pointer items-center space-x-2 rounded border p-2 transition-colors ${
                            isSelected
                              ? "border-amber-500/40 bg-amber-500/10"
                              : "border-transparent hover:bg-muted/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="mentor-stakeholder"
                            className="border-border bg-background"
                            checked={isSelected}
                            onChange={() => setSelectedUser(user.id)}
                          />
                          <span className="flex w-full items-center justify-between gap-2 pr-2 text-sm">
                            <span>
                              {user.name}{" "}
                              <span className="text-xs text-muted-foreground">
                                ({user.email})
                              </span>
                            </span>
                            {isJudge && (
                              <span className="shrink-0 rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                                Judge
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    },
                  )}
                  {filteredModalUsers.length === 0 && (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      No stakeholders found.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-xs font-semibold uppercase text-muted-foreground">
                    Select Teams{" "}
                    <span className="text-xs font-normal normal-case text-muted-foreground/80">
                      ({selectableMentorTeams.length} available / {filteredMentorTeams.length} total)
                    </span>
                  </label>
                  <Select
                    value={
                      selectedMentorTrackId === null
                        ? "all"
                        : String(selectedMentorTrackId)
                    }
                    onValueChange={(value) => {
                      if (!value) return;
                      setSelectedMentorTrackId(value === "all" ? null : Number(value));
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label="Select track"
                      className="min-w-32 bg-muted/30"
                    >
                      <SelectValue>{selectedMentorTrackName}</SelectValue>
                    </SelectTrigger>
                    <SelectContent align="end" alignItemWithTrigger={false}>
                      <SelectItem value="all">All Tracks</SelectItem>
                      {roundTracks.map((track) => (
                        <SelectItem key={track.id} value={String(track.id)}>
                          {track.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="max-h-[220px] space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {isFetchingMentorTeams ? (
                    <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading teams...
                    </div>
                  ) : isMentorTeamsError ? (
                    <p className="p-2 text-sm text-destructive">
                      Failed to load teams. Please try again.
                    </p>
                  ) : filteredMentorTeams.length > 0 ? (
                    <>
                      <label
                        className={`mb-1 flex items-center space-x-2 rounded border p-2 ${
                          selectableMentorTeams.length === 0
                            ? "cursor-not-allowed opacity-50 border-transparent"
                            : areAllMentorTeamsSelected
                              ? "cursor-pointer border-amber-500/40 bg-amber-500/10"
                              : "cursor-pointer border-transparent hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-border bg-background"
                          checked={areAllMentorTeamsSelected}
                          disabled={selectableMentorTeams.length === 0}
                          onChange={(e) => {
                            setSelectedTeamIds(
                              e.target.checked
                                ? selectableMentorTeams.map((team) => team.id)
                                : [],
                            );
                          }}
                        />
                        <span className="text-sm font-semibold">
                          Select All ({selectableMentorTeams.length} available)
                        </span>
                      </label>
                      {filteredMentorTeams.map((team) => {
                        const assignedMentorName = (team.mentorAssignments as any)?.[0]?.mentor?.name;
                        const hasMentor = Boolean(team.mentorAssignments && team.mentorAssignments.length > 0);
                        const isSelected = selectedTeamIds.includes(team.id);

                        if (hasMentor) {
                          return (
                            <label
                              key={team.id}
                              title={`Already assigned to mentor ${assignedMentorName ?? ""}`}
                              className="flex cursor-not-allowed items-center space-x-2 rounded border border-border/40 bg-muted/20 p-2 opacity-65 transition-colors"
                            >
                              <span className="inline-block cursor-not-allowed pointer-events-auto flex items-center">
                                <input
                                  type="checkbox"
                                  disabled
                                  checked={false}
                                  className="rounded border-border bg-background cursor-not-allowed"
                                />
                              </span>
                              <span className="flex w-full items-center justify-between gap-3 pr-2 text-sm text-muted-foreground">
                                <span className="line-through">{team.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="shrink-0 text-xs text-muted-foreground/70">
                                    {team.track?.name || "Track not assigned"}
                                  </span>
                                  <span className="shrink-0 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                    Mentor: {assignedMentorName ?? "Assigned"}
                                  </span>
                                </div>
                              </span>
                            </label>
                          );
                        }

                        return (
                          <label
                            key={team.id}
                            className={`flex cursor-pointer items-center space-x-2 rounded border p-2 transition-colors ${
                              isSelected
                                ? "border-amber-500/40 bg-amber-500/10"
                                : "border-transparent hover:bg-muted/50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="rounded border-border bg-background"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTeamIds((current) => [
                                    ...current,
                                    team.id,
                                  ]);
                                } else {
                                  setSelectedTeamIds((current) =>
                                    current.filter((id) => id !== team.id),
                                  );
                                }
                              }}
                            />
                            <span className="flex w-full items-center justify-between gap-3 pr-2 text-sm">
                              <span className="font-medium">{team.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {team.track?.name || "Track not assigned"}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </>
                  ) : (
                    <p className="p-2 text-sm text-muted-foreground">
                      No approved teams found
                      {selectedMentorTrackId === null
                        ? " in this round."
                        : " for this track in this round."}
                    </p>
                  )}
                </div>
              </div>

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

      <Dialog
        open={!!dualRoleConfirm}
        onOpenChange={(open) => {
          if (!open) setDualRoleConfirm(null);
        }}
      >
        <DialogContent className="sm:max-w-[420px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Confirm dual role</DialogTitle>
            <DialogDescription>
              {dualRoleConfirm?.kind === "judge" ? (
                <>
                  <strong>{dualRoleConfirm.names.join(", ")}</strong>{" "}
                  {dualRoleConfirm.names.length === 1 ? "is" : "are"} already a
                  mentor. Assign as judge too? They will not be able to score
                  teams they mentor.
                </>
              ) : (
                <>
                  <strong>{dualRoleConfirm?.names.join(", ")}</strong> is
                  already a judge. Assign as mentor too? They will not be able
                  to score the team(s) they mentor.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDualRoleConfirm(null)}>
              No
            </Button>
            <Button
              className={
                dualRoleConfirm?.kind === "judge"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }
              onClick={() => {
                const kind = dualRoleConfirm?.kind;
                setDualRoleConfirm(null);
                if (kind === "judge") doAssignJudge();
                else doAssignMentor();
              }}
            >
              Yes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
