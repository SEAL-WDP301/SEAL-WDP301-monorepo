"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  CalendarDays,
  ChevronLeft,
  MessageSquareText,
  Settings,
  Trophy,
  UploadCloud,
  User,
  UserRoundCog,
  UsersRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import Logo from "@/components/ui/logo";

interface DashboardSidebarProps {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}

const menus = [
  {
    label: "Overview",
    href: "/student/dashboard",
    icon: UserRoundCog,
  },

  {
    label: "Events",
    href: "/student/events",
    icon: Trophy,
  },

  {
    label: "Members",
    href: "/student/teams",
    icon: UsersRound,
  },

  {
    label: "Mentor",
    href: "/student/mentor",
    icon: MessageSquareText,
  },

  {
    label: "Submissions",
    href: "/student/submissions",
    icon: UploadCloud,
  },

  {
    label: "Schedule",
    href: "/student/schedule",
    icon: CalendarDays,
  },

  {
    label: "Profile",
    href: "/student/profile",
    icon: User,
  },

  {
    label: "Team Settings",
    href: "/student/settings",
    icon: Settings,
  },
];

export function Sidebar({
  collapsed,
  setCollapsed,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "relative hidden border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-all duration-300 lg:flex lg:flex-col",
        collapsed ? "w-[92px]" : "w-[280px]"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border transition-all duration-300",
          collapsed
            ? "justify-center p-4"
            : "justify-start p-6"
        )}
      >
        <Logo collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4">
        <nav className="space-y-2">
          {menus.map((item) => {
            const Icon = item.icon;

            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-2xl text-sm font-medium transition-all duration-300",
                  collapsed
                    ? "justify-center px-0 py-3"
                    : "gap-3 px-4 py-3",
                  active
                    ? "bg-orange-500/15 text-orange-400 shadow-[0_0_30px_rgba(243,112,33,0.15)] ring-1 ring-orange-500/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />

                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200",
                    collapsed
                      ? "w-0 overflow-hidden opacity-0"
                      : "w-auto opacity-100"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Collapse Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-4 top-1/2 z-50 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-lg transition-all hover:scale-105"
      >
        <ChevronLeft
          className={cn(
            "h-4 w-4 transition-transform duration-300",
            collapsed && "rotate-180"
          )}
        />
      </button>
    </aside>
  );
}