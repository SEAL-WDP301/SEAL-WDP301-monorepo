"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '@/lib/axios';
import { UserPlus, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { enqueueSnackbar } from 'notistack';
import Link from 'next/link';

export function InvitationsMenu() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['pendingInvitations'],
    queryFn: async () => {
      const res = await axiosClient.get('/student/teams/invitations/pending');
      return res.data.data;
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (teamId: number) => {
      return axiosClient.post(`/student/teams/invitations/${teamId}/accept`);
    },
    onSuccess: () => {
      enqueueSnackbar('Invitation accepted!', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['pendingInvitations'] });
      queryClient.invalidateQueries({ queryKey: ['studentEventStatus'] });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Failed to accept invitation', { variant: 'error' });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (teamId: number) => {
      return axiosClient.post(`/student/teams/invitations/${teamId}/reject`);
    },
    onSuccess: () => {
      enqueueSnackbar('Invitation rejected!', { variant: 'info' });
      queryClient.invalidateQueries({ queryKey: ['pendingInvitations'] });
      queryClient.invalidateQueries({ queryKey: ['studentEventStatus'] });
    },
    onError: () => {
      enqueueSnackbar('Failed to reject invitation', { variant: 'error' });
    }
  });

  const invitations = data || [];
  const pendingCount = invitations.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <UserPlus className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          {pendingCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        <DropdownMenuLabel className="font-bold flex items-center justify-between">
          <span>Invitations</span>
          {pendingCount > 0 && (
            <span className="bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 text-xs px-2 py-0.5 rounded-full">
              {pendingCount} New
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {isLoading ? (
          <div className="py-4 text-center text-sm text-muted-foreground">Loading...</div>
        ) : pendingCount === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <UserPlus className="h-8 w-8 opacity-20" />
            <p>No pending invitations</p>
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {invitations.map((inv: any) => (
              <div 
                key={inv.id} 
                className="p-3 rounded-lg bg-muted/50 border border-border flex flex-col gap-2"
              >
                <div>
                  <p className="text-sm font-medium leading-none mb-1">
                    Team <span className="text-orange-500 font-bold">{inv.team.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Invited by <span className="font-semibold text-foreground">{inv.team.leader?.name || 'Leader'}</span>
                  </p>
                  <Link href={`/home/events/${inv.team.eventId}`} className="text-xs text-blue-500 hover:underline line-clamp-1 mt-1">
                    Event: {inv.team.event?.name}
                  </Link>
                </div>
                
                <div className="flex items-center gap-2 mt-1">
                  <Button 
                    size="sm" 
                    className="h-7 text-xs flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => acceptMutation.mutate(inv.team.id)}
                    disabled={acceptMutation.isPending || rejectMutation.isPending}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Accept
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-xs flex-1 border-red-500/30 text-red-500 hover:bg-red-500/10"
                    onClick={() => rejectMutation.mutate(inv.team.id)}
                    disabled={acceptMutation.isPending || rejectMutation.isPending}
                  >
                    <XCircle className="w-3 h-3 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
