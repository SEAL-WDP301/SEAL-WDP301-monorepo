"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { RoleGuard } from "@/components/auth/role-guard";
import { AdminMobileSidebar, AdminSidebar } from "@/components/admin/admin-sidebar";
import { ProfileChecker } from "@/components/layout/public/profile-checker";
import HomeHeader from "@/components/layout/dashboard/home-header";

export default function OrganizerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isEventWorkspace = /^\/organizer\/events\/[^/]+(?:\/|$)/.test(pathname)
    && pathname !== "/organizer/events/create";

  if (isEventWorkspace) {
    return (
      <RoleGuard allowedRoles={["admin", "organizer"]}>
        <ProfileChecker />
        {children}
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={["admin", "organizer"]}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <AdminSidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />
        <AdminMobileSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <HomeHeader showLogo={false} />
          <ProfileChecker />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1680px] px-4 pb-12 pt-16 sm:px-6 lg:px-8 lg:pt-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
