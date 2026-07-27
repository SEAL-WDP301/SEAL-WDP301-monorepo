"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  Bell,
  ChartNoAxesCombined,
  ChevronLeft,
  ClipboardCheck,
  FileCheck2,
  LayoutDashboard,
  MessageSquareText,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import Logo from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMentorFeedback, getMentorSubmissions } from "@/lib/api/mentor.api";
import { axiosClient } from "@/lib/axios";
import { useSocket } from "@/lib/hooks/useSocket";
import { useEffect } from "react";

interface MentorSidebarProps {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  id?: string;
  badge?: string;
}

interface MentorTeamNavItem {
  id: number;
  unreadCount?: number;
  lastMessageAt?: string;
}

interface ChatMessageEvent {
  teamId: number;
  createdAt?: string;
}

interface MentorEventRound {
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
}

interface MentorEventSummary {
  rounds?: MentorEventRound[];
}

const getNavItems = (eventId: string): NavItem[] => {
  const base = `/mentor/events/${eventId}`;
  return [
    { label: "Dashboard", href: base, icon: LayoutDashboard },
    { label: "My Teams", href: `${base}/teams`, icon: UsersRound },
    { label: "Messages", href: `${base}/messages`, icon: MessageSquareText, id: "messages" },
    { label: "Team Progress", href: `${base}/progress`, icon: ChartNoAxesCombined },
    { label: "Feedback", href: `${base}/feedback`, icon: ClipboardCheck, id: "feedback" },
    { label: "Submissions Review", href: `${base}/submissions`, icon: FileCheck2, id: "submissions" },
    { label: "Notifications", href: `${base}/notifications`, icon: Bell },


  ];
};

export function MentorSidebar({
  collapsed,
  setCollapsed,
}: MentorSidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const eventId = params.eventId as string || "1";

  const { data: event } = useQuery<MentorEventSummary | null>({
    queryKey: ["mentorEvent", eventId],
    queryFn: async () => {
      const { data } = await axiosClient.get(`/public/events/${eventId}`);
      return data.data ?? null;
    },
    enabled: !!eventId,
  });

  const { data: feedbacks } = useQuery({
    queryKey: ["mentorFeedback", eventId],
    queryFn: () => getMentorFeedback(eventId),
  });

  const { data: submissions } = useQuery({
    queryKey: ["mentorSubmissions", eventId],
    queryFn: () => getMentorSubmissions(eventId),
  });

  const feedbackCount = feedbacks?.length || 0;
  const submissionsCount = submissions?.length || 0;


  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket("/chat");

  const { data: teams } = useQuery<MentorTeamNavItem[]>({
    queryKey: ["mentorTeams", eventId],
    queryFn: async () => {
      const { data } = await axiosClient.get(`/mentor/teams?eventId=${eventId}`);
      return data.data || [];
    },
    enabled: !!eventId,
  });

  // Global socket listener for mentor's teams
  useEffect(() => {
    if (!socket || !isConnected || !teams || teams.length === 0) return;

    // Join all team rooms
    teams.forEach((team) => {
      socket.emit("join_team_room", team.id);
    });

    const handleReceiveMessage = (newMessage: ChatMessageEvent) => {
      queryClient.setQueryData<MentorTeamNavItem[]>(["mentorTeams", eventId], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((t) => {
          if (t.id === newMessage.teamId) {
            return {
              ...t,
              unreadCount: (t.unreadCount || 0) + 1,
              lastMessageAt: newMessage.createdAt,
            };
          }
          return t;
        });
      });
    };

    const handleMessagesReadUpdated = (updatedMessages: ChatMessageEvent[]) => {
      if (!updatedMessages || updatedMessages.length === 0) return;
      const teamId = updatedMessages[0].teamId;
      queryClient.setQueryData<MentorTeamNavItem[]>(["mentorTeams", eventId], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((t) => {
          if (t.id === teamId) {
            return { ...t, unreadCount: 0 };
          }
          return t;
        });
      });
    };

    socket.on("receive_chat_message", handleReceiveMessage);
    socket.on("messages_read_updated", handleMessagesReadUpdated);

    return () => {
      teams.forEach((team) => {
        socket.emit("leave_team_room", team.id);
      });
      socket.off("receive_chat_message", handleReceiveMessage);
      socket.off("messages_read_updated", handleMessagesReadUpdated);
    };
  }, [socket, isConnected, teams, queryClient, eventId]);

  const unreadMessagesCount = teams?.reduce((acc, team) => acc + ((team.unreadCount ?? 0) > 0 ? 1 : 0), 0) || 0;

  const navItems = getNavItems(eventId).map((item) => {
    if (item.id === "feedback" && feedbackCount > 0)
      return { ...item, badge: feedbackCount > 99 ? "99+" : feedbackCount.toString() };
    if (item.id === "submissions" && submissionsCount > 0)
      return { ...item, badge: submissionsCount > 99 ? "99+" : submissionsCount.toString() };
    if (item.id === "messages" && unreadMessagesCount > 0)
      return { ...item, badge: unreadMessagesCount > 99 ? "99+" : unreadMessagesCount.toString() };
    return item;
  });

  return (
    <aside
      className={cn(
        "relative hidden h-screen shrink-0 border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-all duration-300 lg:flex lg:flex-col",
        collapsed ? "w-[92px]" : "w-[280px]"
      )}
    >
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border transition-all duration-300",
          collapsed ? "justify-center p-4" : "justify-start p-6"
        )}
      >
        <Logo collapsed={collapsed} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === `/mentor/events/${eventId}`
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            const currentRound = event?.rounds?.find((r) => r.status === 'open' || r.status === 'not_started') || event?.rounds?.[0];
            const isRoundHasDates = !!(currentRound?.startDate || currentRound?.endDate);
            const shouldDisable = isRoundHasDates && currentRound?.status === 'not_started';

            const isDisabled = shouldDisable && (item.label === "Submissions Review" || item.label === "Team Progress");

            const linkContent = (
              <Link
                key={item.href}
                href={isDisabled ? "#" : item.href}
                title={collapsed && !isDisabled ? item.label : undefined}
                className={cn(
                  "relative flex items-center rounded-2xl text-sm font-medium transition-all duration-300",
                  collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3",
                  active
                    ? "bg-orange-500/15 text-orange-400 shadow-[0_0_30px_rgba(243,112,33,0.15)] ring-1 ring-orange-500/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  isDisabled && "opacity-50 cursor-not-allowed pointer-events-none"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed ? (
                  <div className="flex flex-1 items-center justify-between">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    )}
                  </div>
                ) : (
                  item.badge && (
                    <span className="absolute right-2 top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500 px-1 text-[8px] font-bold text-white">
                      {item.badge}
                    </span>
                  )
                )}
              </Link>
            );

            return isDisabled ? (
              <div key={item.href} title="Round has not started yet">
                {linkContent}
              </div>
            ) : linkContent;
          })}
        </nav>
      </div>

      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand mentor sidebar" : "Collapse mentor sidebar"}
        className="absolute -right-4 top-1/2 z-50 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-lg transition-all hover:scale-105"
      >
        <ChevronLeft
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-300",
            collapsed && "rotate-180"
          )}
        />
      </button>
    </aside>
  );
}
