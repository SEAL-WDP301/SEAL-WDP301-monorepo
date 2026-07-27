"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays, ChevronLeft, ClipboardCheck, FileCheck,
  LayoutDashboard, Menu, Users,
} from "lucide-react";
import Logo from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const groups = [
  { label: "Overview", items: [{ label: "Dashboard", href: "/organizer/dashboard", icon: LayoutDashboard }] },
  {
    label: "Management",
    items: [
      { label: "Events", href: "/organizer/events", icon: CalendarDays },
      { label: "Registrations", href: "/organizer/registrations", icon: ClipboardCheck },
      { label: "People", href: "/organizer/people", icon: Users },
      { label: "Submissions", href: "/organizer/submissions", icon: FileCheck },
    ],
  },
];

interface SidebarContentProps {
  collapsed?: boolean;
  tabletCollapsed?: boolean;
}

function SidebarContent({ collapsed = false, tabletCollapsed = false }: SidebarContentProps) {
  const pathname = usePathname();
  return (
    <>
      <div className={cn("flex h-20 items-center border-b border-border px-5", collapsed && "justify-center px-2", tabletCollapsed && !collapsed && "lg:justify-center lg:px-2 xl:justify-start xl:px-5")}>
        {tabletCollapsed && !collapsed ? <><div className="lg:hidden xl:block"><Logo href="/organizer/dashboard" size="sm" /></div><div className="hidden lg:block xl:hidden"><Logo href="/organizer/dashboard" collapsed size="sm" /></div></> : <Logo href="/organizer/dashboard" collapsed={collapsed} size="sm" />}
      </div>
      <nav className="flex-1 space-y-7 overflow-y-auto p-4" aria-label="Organizer navigation">
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed && <p className={cn("mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground", tabletCollapsed && "lg:hidden xl:block")}>{group.label}</p>}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = item.href === "/organizer/dashboard"
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex h-10 items-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
                      collapsed ? "justify-center" : tabletCollapsed ? "justify-center xl:justify-start xl:gap-3 xl:px-3" : "gap-3 px-3",
                      active ? "bg-orange-500/12 text-[#ff8a3d] ring-1 ring-orange-500/20" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" />
                    {!collapsed && <span className={cn(tabletCollapsed && "lg:hidden xl:inline")}>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {!collapsed && (
        <div className={cn("border-t border-border p-4", tabletCollapsed && "lg:hidden xl:block")}>
          <div className="rounded-xl border border-border bg-white/[0.025] p-3">
            <p className="text-xs font-medium">SEAL Organizer</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Hackathon management console</p>
          </div>
        </div>
      )}
    </>
  );
}

export function AdminSidebar({ collapsed, onCollapsedChange }: { collapsed: boolean; onCollapsedChange: (value: boolean) => void }) {
  return (
    <aside className={cn("relative hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 lg:flex", collapsed ? "w-[76px]" : "w-[76px] xl:w-[248px]")}>
      <SidebarContent collapsed={collapsed} tabletCollapsed />
      <button
        type="button"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={() => onCollapsedChange(!collapsed)}
        className="absolute -right-3 top-24 z-10 grid size-7 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
      >
        <ChevronLeft className={cn("size-3.5 transition-transform", collapsed && "rotate-180")} />
      </button>
    </aside>
  );
}

export function AdminMobileSidebar() {
  return (
    <div className="fixed left-4 top-24 z-40 lg:hidden">
      <Sheet>
        <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Open admin navigation" />}>
          <Menu />
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] gap-0 p-0">
          <SheetTitle className="sr-only">Organizer navigation</SheetTitle>
          <SheetDescription className="sr-only">SEAL administration sections</SheetDescription>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </div>
  );
}
