"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Users, Target, MessageSquare, ExternalLink } from "lucide-react";
import { FloatingTeamChat } from "@/components/floating-team-chat";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useSocket } from "@/lib/hooks/useSocket";

export default function MentorMessagesPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const eventId = params.eventId as string;
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { socket, isConnected } = useSocket("/chat");

  const { data: user } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const res = await axiosClient.get('/users/profile');
      return res.data.data;
    },
  });

  const { data: teams, isLoading } = useQuery({
    queryKey: ["mentorTeams", eventId],
    queryFn: async () => {
      const res = await axiosClient.get(`/mentor/teams?eventId=${eventId}`);
      return res.data.data;
    },
    enabled: !!eventId,
  });

  const sortedTeams = teams ? [...teams].sort((a: any, b: any) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
    const aDate = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : (a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0);
    const bDate = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : (b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0);
    return bDate - aDate;
  }) : [];

  const filteredTeams = sortedTeams.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (t.track?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const maxRoundNumber = teams ? Math.max(...teams.flatMap((t: any) => t.teamRounds?.map((tr: any) => tr.round?.roundNumber || 0) || [0])) : 0;

  // Default select first team
  useEffect(() => {
    if (sortedTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(sortedTeams[0].id);
    }
  }, [sortedTeams, selectedTeamId]);

  // Join all team rooms to receive global notifications
  useEffect(() => {
    if (socket && isConnected && teams?.length > 0) {
      const teamIds = teams.map((t: any) => t.id);
      socket.emit("join_multiple_team_rooms", teamIds);
    }
  }, [socket, isConnected, teams]);

  const handleTeamSelect = (team: any) => {
    setSelectedTeamId(team.id);
    // Optimistically clear unread count
    if (team.unreadCount > 0) {
      queryClient.setQueryData(["mentorTeams", eventId], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((t: any) => t.id === team.id ? { ...t, unreadCount: 0 } : t);
      });
    }
  };

  const selectedTeamData = sortedTeams.find(t => t.id === selectedTeamId);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Left side: Teams list */}
      <div className="w-[280px] shrink-0 flex flex-col gap-3 min-h-0">
        <div className="shrink-0">
          <h2 className="text-lg font-bold tracking-tight mb-3">Messages</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Search teams..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-orange-500"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 no-scrollbar space-y-2">
          {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
          ) : filteredTeams.map((team: any) => {
          const latestTeamRound = team.teamRounds?.sort((a: any, b: any) => (b.round?.roundNumber || 0) - (a.round?.roundNumber || 0))?.[0];
          const currentRound = latestTeamRound?.round;
          const status = latestTeamRound?.status; // "competing", "advanced", "eliminated"
          const acceptedMembers = (team.members || []).filter((m: any) => m.status === 'accepted' || m.role === 'leader');
          
          let statusBadge = null;
          if (status === "eliminated") {
            statusBadge = <span className="text-[9px] font-semibold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-sm">Eliminated</span>;
          } else if (status === "advanced") {
            statusBadge = <span className="text-[9px] font-semibold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-sm">Passed</span>;
          } else if (status === "competing") {
            if (currentRound?.roundNumber === maxRoundNumber) {
              statusBadge = <span className="text-[9px] font-semibold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded-sm">Current</span>;
            } else {
              statusBadge = <span className="text-[9px] font-semibold text-zinc-500 bg-zinc-500/10 px-1.5 py-0.5 rounded-sm">Past Round</span>;
            }
          }

          return (
            <Card 
              key={team.id}
              onClick={() => handleTeamSelect(team)}
              className={`relative p-2.5 cursor-pointer transition-all hover:border-orange-500/50 hover:shadow-sm ${
                selectedTeamId === team.id 
                  ? 'border-orange-500 ring-1 ring-orange-500 shadow-sm bg-orange-50/50 dark:bg-orange-500/10' 
                  : team.unreadCount > 0
                  ? 'border-red-400 bg-red-50 dark:bg-red-950/40 ring-1 ring-red-400/50 shadow-sm'
                  : ''
              }`}
            >
              {team.unreadCount > 0 && (
                <div className="absolute -top-2 -right-2 z-10 flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white border-2 border-background rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)] text-[10px] font-bold animate-pulse">
                  {team.unreadCount > 99 ? '99+' : team.unreadCount}
                </div>
              )}
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-semibold text-sm line-clamp-1 pr-2">{team.name}</h3>
                {team.track && <Badge variant="outline" className="shrink-0 text-[8px] h-4 px-1">{team.track.name}</Badge>}
              </div>
              
              {currentRound && (
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Target className="h-2.5 w-2.5" />
                    <span className="truncate max-w-[120px]">{currentRound.name}</span>
                  </div>
                  {statusBadge}
                </div>
              )}

              {team.lastMessage && (
                <div className="text-[11px] text-muted-foreground mb-2 line-clamp-1 pr-4" title={team.lastMessage.content}>
                  <span className="font-medium text-foreground/80">{team.lastMessage.sender?.id === user?.id ? 'You' : (team.lastMessage.sender?.name || 'System')}:</span> <span className={team.unreadCount > 0 ? "text-foreground font-bold" : ""}>{team.lastMessage.content}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between mt-1">
                <div className="flex -space-x-1">
                   {acceptedMembers.slice(0, 3).map((m: any, idx: number) => (
                     <Avatar key={`avatar-${team.id}-${m.user?.id || 'anon'}-${idx}`} className="h-4 w-4 border border-background">
                       <AvatarImage src={m.user?.avatarUrl || m.user?.avatar_url} />
                       <AvatarFallback className="text-[6px]">{m.user?.name?.charAt(0) || 'U'}</AvatarFallback>
                     </Avatar>
                   ))}
                   {acceptedMembers.length > 3 && (
                     <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[6px] border border-background z-10 font-medium">
                       +{acceptedMembers.length - 3}
                     </div>
                   )}
                </div>
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{acceptedMembers.length}</span>
                </div>
              </div>
            </Card>
          );
          })}
          {teams?.length === 0 && (
             <div className="text-center py-10 text-muted-foreground text-sm">
               No teams found.
             </div>
          )}
          {teams?.length > 0 && filteredTeams.length === 0 && (
             <div className="text-center py-10 text-muted-foreground text-sm">
               No teams match your search.
             </div>
          )}
        </div>
      </div>

      {/* Right side: Chat */}
      <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden relative flex flex-col">
        {selectedTeamId ? (
          <>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-[15px] leading-tight flex items-center gap-2">
                    {selectedTeamData?.name}
                    <span className="flex h-2 w-2 relative" title="Live Chat Connection Active">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                  </h3>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Target className="h-3 w-3" />
                    <span>{selectedTeamData?.track?.name || 'Hackathon Team'}</span>
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5 h-8 text-[11px] font-medium"
                onClick={() => router.push(`/mentor/events/${eventId}/teams/${selectedTeamId}`)}
              >
                View Team <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex-1 relative min-h-0">
              <FloatingTeamChat teamId={selectedTeamId} teamName={selectedTeamData?.name} inline={true} defaultOpen={true} />
            </div>
          </>
        ) : (
          <div className="flex flex-col h-full items-center justify-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 text-muted-foreground/30" />
            <p>Select a team from the list to start messaging.</p>
          </div>
        )}
      </div>
    </div>
  );
}
