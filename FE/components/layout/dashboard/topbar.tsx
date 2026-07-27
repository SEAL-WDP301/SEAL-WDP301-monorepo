"use client";

import { ChevronDown } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { NotificationsMenu } from "./notifications-menu";
import Logo from "@/components/ui/logo";
import { useQuery } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { useAuthStore } from "@/lib/stores/auth.store";
import { queryKeys } from "@/lib/query-keys";

import { useAdminCronNotifications } from "@/hooks/use-admin-cron-notifications";

export function Topbar({ customCenterContent, showDesktopLogo }: { customCenterContent?: React.ReactNode, showDesktopLogo?: boolean }) {
    useAdminCronNotifications();
    const storeUser = useAuthStore((state) => state.user);
    const setUser = useAuthStore((state) => state.setUser);

    // Fetch Current User with Zustand initialData
    const { data: user } = useQuery({
        queryKey: queryKeys.user,
        queryFn: async () => {
            const token = useAuthStore.getState().accessToken;
            if (!token) {
                setUser(null);
                return null;
            }
            const res = await axiosClient.get('/users/profile');
            const profile = res.data?.data;
            if (profile) setUser(profile);
            return profile;
        },
        initialData: storeUser || undefined,
    });

    // Helper function to get initials
    const getInitials = (name?: string) => {
        if (!name) return "U";
        return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
    };

    const getProfileHref = () => {
        const role = user?.role?.toLowerCase();
        if (role === "student") return "/student/profile";
        if (role === "judge") return "/judge/profile";
        if (role === "stakeholder") return "/stakeholder/profile";
        if (role === "admin" || role === "organizer") return "/organizer/profile";
        return "/home";
    };

    const userRole = user?.role?.toLowerCase();

    const renderUserIdentity = (showChevron: boolean) => (
        <>
            <Avatar className="h-9 w-9 overflow-hidden border border-orange-500/30">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="Avatar" />}
                <AvatarFallback className="bg-orange-500/15 text-sm font-bold text-orange-400">
                    {user ? getInitials(user.name) : "U"}
                </AvatarFallback>
            </Avatar>

            <div className="hidden text-left leading-tight md:block">
                <p className="max-w-[120px] truncate text-sm font-semibold text-foreground">
                    {user ? user.name : "Loading..."}
                </p>

                <p className="text-[11px] capitalize text-muted-foreground">
                    {user ? user.role : "User"}
                </p>
            </div>

            {showChevron && (
                <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:block" />
            )}
        </>
    );

    return (
        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
            {/* Giảm min-h xuống 16 (h-16) trên mobile để đỡ chiếm diện tích, lên lg mới là min-h-20 */}
            <div className="flex min-h-16 lg:min-h-20 items-center gap-2 md:gap-4 px-4 py-3 lg:px-8">

                {/* Logo: Hiện trên Mobile, hoặc hiện trên Desktop nếu được yêu cầu (ví dụ khi ẩn Sidebar) */}
                <div className={`flex items-center ${!showDesktopLogo ? "lg:hidden" : "mr-4"}`}>
                    <Logo size="sm" showText={showDesktopLogo} />
                </div>

                {/* Khu vực Search hoặc Custom Content */}
                <div id="topbar-center-content" className="relative mr-auto flex items-center md:flex-1 pr-2 overflow-x-auto no-scrollbar">
                    {customCenterContent ? (
                        customCenterContent
                    ) : null}
                </div>

                <ThemeToggle />

                {/* Notification */}
                <NotificationsMenu />

                {/* User */}
                <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-3 rounded-2xl border border-border bg-card px-2 py-1.5 outline-none transition-colors hover:bg-muted">
                        {renderUserIdentity(true)}
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        align="end"
                        className="w-56 border border-border bg-popover/95 backdrop-blur-xl"
                    >
                        <DropdownMenuLabel>
                            My Account
                        </DropdownMenuLabel>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem asChild>
                            <Link href={`${getProfileHref()}?tab=info`} className="flex items-center gap-2 cursor-pointer">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                My Profile
                            </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem asChild>
                            <Link href={`${getProfileHref()}?tab=history`} className="flex items-center gap-2 cursor-pointer">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                Participation History
                            </Link>
                        </DropdownMenuItem>

                        {userRole === "student" && (
                            <DropdownMenuItem asChild>
                                <Link href="/student/settings" className="cursor-pointer">
                                    Team Settings
                                </Link>
                            </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            className="text-red-500 focus:text-red-500 focus:bg-red-500/10 cursor-pointer"
                            onClick={() => {
                                useAuthStore.getState().clearAccessToken();
                                window.dispatchEvent(new Event('auth-unauthorized'));
                                window.location.href = '/login';
                            }}
                        >
                            Logout
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

            </div>
        </header>
    );
}
