"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { usePathname } from "next/navigation";

import { Topbar } from "@/components/layout/dashboard/topbar";
import { ProfileChecker } from "@/components/layout/public/profile-checker";
import { Sidebar } from "@/components/layout/dashboard/sidebar";
import HomeHeader from "@/components/layout/dashboard/home-header";
import { RoleGuard } from "@/components/auth/role-guard";

interface DashboardLayoutProps {
    children: ReactNode;
}

export default function StudentLayout({
    children,
}: DashboardLayoutProps) {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();

    // Hide sidebar and global topbar for workspace routes since they have their own navigation header
    const isWorkspace = pathname?.includes("/workspace");
    const isProfile = pathname?.includes("/profile");

    const hideSidebar = isWorkspace || isProfile;

    return (
        <RoleGuard allowedRoles={["student"]}>
        <div className="min-h-screen bg-background text-foreground">
            <div className="flex h-screen overflow-hidden">
                {/* Sidebar */}
                {!hideSidebar && (
                    <Sidebar
                        collapsed={collapsed}
                        setCollapsed={setCollapsed}
                    />
                )}
                <div className="flex h-screen flex-1 flex-col overflow-hidden">
                    {isProfile && <HomeHeader />}
                    {!isWorkspace && !isProfile && <Topbar />}
                    <ProfileChecker />

                    {/* Content */}
                    <main className="flex-1 overflow-y-auto">
                        {isWorkspace ? (
                            children
                        ) : (
                            <div className="p-6 max-w-7xl mx-auto w-full">
                                {children}
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
        </RoleGuard>
    );
}
