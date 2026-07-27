"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Users, UserPlus, Trash2, Phone } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { enqueueSnackbar } from "notistack";

interface TeamDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  team: any;
  eventId: string | number;
  showRejected?: boolean;
}

export function TeamDetailsDialog({ isOpen, onClose, team, eventId, showRejected = true }: TeamDetailsDialogProps) {
  const queryClient = useQueryClient();
  const [isAssignMentorOpen, setIsAssignMentorOpen] = useState(false);
  const [selectedMentorUser, setSelectedMentorUser] = useState<number | "">("");

  // Fetch stakeholders for assigning mentors
  const { data: stakeholders, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["organizerStakeholders", eventId],
    queryFn: async () => {
      const res = await axiosClient.get(`/organizer/assignments/events/${eventId}`);
      return res.data.data;
    },
    enabled: isOpen,
  });

  const assignMentorMutation = useMutation({
    mutationFn: async ({ teamId, stakeholderId }: { teamId: number, stakeholderId: number }) => {
      const res = await axiosClient.post(`/organizer/assignments/teams/${teamId}/mentors`, { stakeholderId });
      return res.data;
    },
    onSuccess: () => {
      enqueueSnackbar('Mentor assigned successfully', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ["organizerTeams", eventId] });
      queryClient.invalidateQueries({ queryKey: ["organizerStakeholders", eventId] });
      setIsAssignMentorOpen(false);
      setSelectedMentorUser("");
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Failed to assign mentor', { variant: 'error' });
    }
  });

  const unassignMentorMutation = useMutation({
    mutationFn: async ({ teamId, stakeholderId }: { teamId: number, stakeholderId: number }) => {
      const res = await axiosClient.delete(`/organizer/assignments/teams/${teamId}/mentors/${stakeholderId}`);
      return res.data;
    },
    onSuccess: () => {
      enqueueSnackbar('Mentor unassigned successfully', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ["organizerTeams", eventId] });
      queryClient.invalidateQueries({ queryKey: ["organizerStakeholders", eventId] });
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Failed to unassign mentor', { variant: 'error' });
    }
  });

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'approved': return <span className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full text-xs font-semibold uppercase tracking-wider">Approved</span>;
      case 'rejected': return <span className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded-full text-xs font-semibold uppercase tracking-wider">Rejected</span>;
      case 'disqualified': return <span className="px-2 py-0.5 bg-gray-500/10 text-gray-500 rounded-full text-xs font-semibold uppercase tracking-wider">Disqualified</span>;
      default: return <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-full text-xs font-semibold uppercase tracking-wider">Pending</span>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if(!open) {
        onClose();
        setIsAssignMentorOpen(false);
      }
    }}>
      <DialogContent className="sm:max-w-[700px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            Team: <span className="text-blue-500">{team?.name}</span>
            {team?.status && (
              <span className="ml-2">
                {getStatusBadge(team.status)}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Review team members, registration details, and assign mentors.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 space-y-6">
          {/* Leader */}
          <div className="p-4 border border-amber-500/30 rounded-lg bg-amber-500/5 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 p-2 opacity-10">
              <Crown className="w-24 h-24 text-amber-500" />
            </div>
            <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Crown className="w-4 h-4" />
              Team Leader
            </h4>
            <div className="flex justify-between items-start relative z-10">
              <div className="flex gap-4">
                <Avatar className="h-12 w-12 border-2 border-amber-500/50 shadow-sm">
                  <AvatarImage src={team?.leader?.avatarUrl || team?.leader?.avatar_url} />
                  <AvatarFallback className="bg-amber-500/20 text-amber-600 font-bold">
                    {team?.leader?.name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground text-base">{team?.leader?.name || 'Unknown'}</p>
                <p className="text-sm text-muted-foreground">{team?.leader?.email}</p>
                {team?.leader?.studentProfile && (
                  <p className="text-xs text-muted-foreground mt-1 flex flex-col gap-1">
                    <span>Code: {team.leader.studentProfile.studentCode} • {team.leader.studentProfile.universityName && (" " + team.leader.studentProfile.universityName)}</span>
                    {team.leader.studentProfile.phone && (
                        <span className="flex items-center gap-1 text-blue-400">
                            <Phone className="w-3 h-3" /> {team.leader.studentProfile.phone}
                        </span>
                    )}
                    {team.leader.studentProfile.githubUsername && (
                        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                            <FaGithub className="w-3 h-3" /> {team.leader.studentProfile.githubUsername}
                        </span>
                    )}
                  </p>
                )}
              </div>
              </div>
              <div className="text-right mt-1">
                <span className="px-2 py-1 bg-green-500/10 text-green-500 rounded-md text-xs font-semibold shadow-sm">Accepted</span>
              </div>
            </div>
          </div>

          {/* Members */}
          <div className="p-4 border border-border rounded-lg bg-muted/20">
            {(() => {
              let otherMembers = team?.members?.filter((m: any) => m.role !== 'leader') || [];
              if (!showRejected) {
                otherMembers = otherMembers.filter((m: any) => m.status !== 'rejected');
              }
              otherMembers.sort((a: any, b: any) => {
                const statusOrder: Record<string, number> = { accepted: 1, pending: 2, rejected: 3 };
                const orderA = statusOrder[a.status] || 99;
                const orderB = statusOrder[b.status] || 99;
                return orderA - orderB;
              });

              return (
                <>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center justify-between">
                    Members 
                    <span className="bg-muted px-2 py-0.5 rounded-full text-foreground">
                      {otherMembers.length}
                    </span>
                  </h4>
                  
                  {otherMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No other members yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {otherMembers.map((member: any) => (
                        <div key={member.id} className="flex justify-between items-start pt-3 border-t border-border/50 first:border-0 first:pt-0">
                          <div className="flex gap-3">
                            <Avatar className="h-10 w-10 border border-border mt-1">
                              <AvatarImage src={member.user?.avatarUrl || member.user?.avatar_url} />
                              <AvatarFallback className="font-medium text-muted-foreground">
                                {member.user?.name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-foreground">{member.user?.name || 'Pending User'}</p>
                            <p className="text-sm text-muted-foreground">{member.user?.email}</p>
                            {member.user?.studentProfile && (
                              <p className="text-xs text-muted-foreground mt-1 flex flex-col gap-1">
                                <span>Code: {member.user.studentProfile.studentCode} • {member.user.studentProfile.universityName && (" " + member.user.studentProfile.universityName)}</span>
                                {member.user.studentProfile.phone && (
                                    <span className="flex items-center gap-1 text-blue-400">
                                        <Phone className="w-3 h-3" /> {member.user.studentProfile.phone}
                                    </span>
                                )}
                                {member.user.studentProfile.githubUsername && (
                                    <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                        <FaGithub className="w-3 h-3" /> {member.user.studentProfile.githubUsername}
                                    </span>
                                )}
                              </p>
                            )}
                            </div>
                          </div>
                          <div className="text-right">
                            {member.status === 'pending' ? (
                              <span className="px-2 py-1 bg-amber-500/10 text-amber-500 rounded-md text-xs font-semibold whitespace-nowrap">
                                Invitation Pending
                              </span>
                            ) : member.status === 'accepted' ? (
                              <span className="px-2 py-1 bg-green-500/10 text-green-500 rounded-md text-xs font-semibold">
                                Accepted
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded-md text-xs font-semibold">
                                Rejected
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Mentors */}
          <div className="p-4 border border-blue-500/20 rounded-lg bg-blue-500/5">
             <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Mentors
              </h4>
              {!isAssignMentorOpen && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 text-xs gap-1 border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
                  onClick={() => setIsAssignMentorOpen(true)}
                >
                  <UserPlus className="w-3 h-3" /> Assign Mentor
                </Button>
              )}
             </div>

             {isAssignMentorOpen && (
               <div className="mb-4 p-3 border border-border rounded bg-background flex flex-col gap-2">
                 <div className="text-xs font-medium text-foreground">Select a Stakeholder to Assign as Mentor</div>
                 <select
                  value={selectedMentorUser}
                  onChange={(e) => setSelectedMentorUser(e.target.value ? Number(e.target.value) : "")}
                  className="w-full bg-muted border border-border text-foreground text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                 >
                  <option value="">-- Choose Stakeholder --</option>
                  {isLoadingUsers ? (
                    <option disabled>Loading...</option>
                  ) : stakeholders?.filter((u: any) => u.role === 'stakeholder').map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                 </select>
                 <div className="flex justify-end gap-2 mt-1">
                   <Button size="sm" variant="ghost" onClick={() => setIsAssignMentorOpen(false)}>Cancel</Button>
                   <Button 
                    size="sm" 
                    disabled={!selectedMentorUser || assignMentorMutation.isPending}
                    onClick={() => assignMentorMutation.mutate({ teamId: team.id, stakeholderId: Number(selectedMentorUser) })}
                   >
                    {assignMentorMutation.isPending ? "Assigning..." : "Assign"}
                   </Button>
                 </div>
               </div>
             )}

             {team?.mentorAssignments?.length === 0 ? (
               <p className="text-sm text-muted-foreground italic">No mentors assigned.</p>
             ) : (
               <div className="space-y-2">
                 {team?.mentorAssignments?.map((assignment: any) => (
                   <div key={assignment.mentorId} className="flex justify-between items-center py-2 border-t border-border/50 first:border-0 first:pt-0">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-blue-500/30">
                        <AvatarImage src={assignment.mentor?.avatarUrl || assignment.mentor?.avatar_url} />
                        <AvatarFallback className="bg-blue-500/10 text-blue-600">
                          {assignment.mentor?.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{assignment.mentor?.name || 'Unknown User'}</p>
                        <p className="text-xs text-muted-foreground">{assignment.mentor?.email}</p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-600 px-2"
                      onClick={() => unassignMentorMutation.mutate({ teamId: team.id, stakeholderId: assignment.mentorId })}
                      disabled={unassignMentorMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                    </Button>
                   </div>
                 ))}
               </div>
             )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
