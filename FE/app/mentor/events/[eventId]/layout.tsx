"use client"
import { useState } from "react";

import { MentorSidebar } from "@/app/mentor/_components/mentor-sidebar";
import { Topbar } from "@/components/layout/dashboard/topbar";
import { RoleGuard } from "@/components/auth/role-guard";

interface MentorLayoutProps {
    children: React.ReactNode;
}

export default function MentorLayout({ children }: MentorLayoutProps) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <RoleGuard allowedRoles={["stakeholder"]}>
        <div className="min-h-screen bg-background text-foreground">
            <div className="flex h-screen overflow-hidden">
                <MentorSidebar
                    collapsed={collapsed}
                    setCollapsed={setCollapsed}
                />

                <div className="flex h-screen flex-1 flex-col overflow-hidden">
                    <Topbar />

                    <main className="flex-1 overflow-y-auto p-6">
                        {children}
                    </main>
                </div>

            </div>
        </div>
        </RoleGuard>
    );
}
