"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Users,
  FileText,
  Calendar,
  UserCheck,
  LayoutDashboard,
  ScrollText,
} from "lucide-react";
import HomeHeader from "@/components/layout/dashboard/home-header";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "@/lib/api/workspace.api";
import { ChevronRight, Trophy, Shield, Target, AlertTriangle, Eye } from "lucide-react";
import { FloatingTeamChat } from "@/components/floating-team-chat";
import { axiosClient } from "@/lib/axios";
import { WorkspaceAccessProvider } from "./workspace-access";


export default function TrackWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const eventId = params.id as string;
  const basePath = `/student/events/${eventId}/workspace`;

  const { data } = useQuery({
    queryKey: ["workspace", eventId],
    queryFn: () => workspaceApi.getWorkspaceOverview(Number(eventId)),
  });

  const eventQuery = useQuery({
    queryKey: ["publicEvent", eventId],
    queryFn: async () => {
      const response = await axiosClient.get(`/public/events/${eventId}`);
      return response.data?.data as { status?: string | null };
    },
  });

  const workspaceData = data?.data;
  const eventName = workspaceData?.team?.event?.name || "Event";
  const teamName = workspaceData?.team?.name || "Team";
  const currentActiveRound = workspaceData?.currentActiveRound;
  const isEliminated = workspaceData?.isEliminated;
  const isLeader = workspaceData?.role === "leader";
  const eventStatus = eventQuery.data?.status?.toLowerCase() || null;
  const isReadOnly =
    eventQuery.isLoading || !eventStatus || !["active", "ongoing"].includes(eventStatus);

  // Read selected round from URL
  const searchParams = useSearchParams();
  const selectedRoundId = searchParams.get("roundId") ? Number(searchParams.get("roundId")) : null;

  // All rounds the team participated in (has teamRound entry), in order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roundSubmissions: any[] = workspaceData?.roundSubmissions || [];
  const participatedRounds = roundSubmissions
    .filter((rs) => rs.teamRound !== null)
    .map((rs) => rs.round);

  // The round currently being viewed (from URL or fall back to active)
  const selectedRound = selectedRoundId
    ? participatedRounds.find((r) => r.id === selectedRoundId) ||
      (workspaceData?.rounds || []).find((r: any) => r.id === selectedRoundId)
    : currentActiveRound;

  // Breadcrumb: show ALL participated rounds (the ones the student is eligible for / has completed)
  const breadcrumbRounds = participatedRounds.length > 0 
    ? participatedRounds 
    : selectedRound 
      ? [selectedRound] 
      : currentActiveRound 
        ? [currentActiveRound] 
        : [];

  const tabs = [
    { name: "Overview", href: basePath, icon: LayoutDashboard },
    { name: "My Team", href: `${basePath}/my-team`, icon: Users },
    { name: "Mentor", href: `${basePath}/mentor`, icon: UserCheck },
    { name: "Submissions", href: `${basePath}/submissions`, icon: FileText },
  ];

  const customTabsContent = (
    <div className="flex items-center gap-2 md:gap-6 w-full justify-center lg:justify-start overflow-x-auto scrollbar-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        // Exact match for base path, startsWith for subpaths
        const isActive = tab.href === basePath ? pathname === basePath : pathname.startsWith(tab.href);
        
        // Persist roundId across tabs
        const tabHref = selectedRoundId && tab.name !== "Mentor" // if you want Mentor to also persist roundId, just remove the condition
          ? `${tab.href}?roundId=${selectedRoundId}`
          : selectedRoundId 
            ? `${tab.href}?roundId=${selectedRoundId}` 
            : tab.href;

        return (
          <Link
            key={tab.href}
            href={tabHref}
            className={cn(
              "flex items-center gap-2 text-sm font-medium transition-all py-2 px-3 rounded-xl whitespace-nowrap",
              isActive
                ? "bg-orange-500/15 text-orange-500 shadow-[0_0_20px_rgba(243,112,33,0.15)] ring-1 ring-orange-500/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.name}
          </Link>
        );
      })}
    </div>
  );

  return (
    <WorkspaceAccessProvider eventStatus={eventStatus} isReadOnly={isReadOnly}>
    <div className="min-h-screen bg-background flex flex-col relative z-10">
      <HomeHeader customCenterContent={customTabsContent} />
      
      {/* Main Content Area */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        {!eventQuery.isLoading && isReadOnly && (
          <div className="mb-8 flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-700 dark:text-blue-300">
            <Eye className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Event ended — view-only workspace</p>
              <p className="mt-1 opacity-80">
                You can review your team, submissions, results, schedule, and feedback, but changes are disabled.
              </p>
            </div>
          </div>
        )}
        {/* Global Workspace Context Banner */}
        {workspaceData && (
          <div className="mb-8 p-3 px-5 rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-500/10 via-background to-background flex items-center gap-3 text-sm overflow-x-auto scrollbar-none whitespace-nowrap shadow-sm shadow-orange-500/5">
            <div className="flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors">
              <Trophy className="h-4 w-4 text-orange-500" />
              <span className="font-semibold">{eventName}</span>
            </div>
            
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            
            <div className="flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors">
              <Shield className="h-4 w-4 text-blue-500" />
              <span className="font-semibold">{teamName}</span>
            </div>

            {/* Breadcrumb rounds: show all participated rounds in order */}
            {breadcrumbRounds.map((round) => {
              const isSelected = selectedRound?.id === round.id;
              return (
                <React.Fragment key={`breadcrumb-${round.id}`}>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  <Link
                    href={`${pathname}?roundId=${round.id}`}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full font-medium transition-colors ${
                      isSelected
                        ? "bg-orange-500/10 border border-orange-500/20 text-orange-500"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isSelected && <Target className="h-4 w-4" />}
                    <span>{round.name}</span>
                  </Link>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {isEliminated && (
          <div className="mb-8 p-4 rounded-2xl border border-red-500/20 bg-red-500/10 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-600 dark:text-red-400">Your team has been eliminated from this round</h4>
              <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                Thank you for participating in the competition. You can still review the results and mentor feedback for past rounds, but you will not be able to participate in upcoming rounds. See you at our future events!
              </p>
            </div>
          </div>
        )}

        {children}
      </main>

      {/* Floating Chat for Team */}
      {workspaceData?.team?.id && (
        <FloatingTeamChat teamId={workspaceData.team.id} readOnly={isReadOnly} />
      )}
    </div>
    </WorkspaceAccessProvider>
  );
}
