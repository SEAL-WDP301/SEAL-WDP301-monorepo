"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '@/lib/axios';
import { enqueueSnackbar } from 'notistack';
import { useEffect } from 'react';

import Logo from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from './theme-toggle';
import { LayoutDashboard, ChevronDown } from 'lucide-react';
import { getRoleHomePath } from '@/components/auth/role-guard';
import { InvitationsMenu } from './invitations-menu';
import { NotificationsMenu } from './notifications-menu';
import { useAuthStore } from '@/lib/stores/auth.store';

// ORGANIZER_MENUS removed per user request

export default function HomeHeader({ customCenterContent, showLogo = true }: { customCenterContent?: React.ReactNode; showLogo?: boolean } = {}) {
    const router = useRouter();
    const queryClient = useQueryClient();

    const { data: user, isLoading, isError } = useQuery({
        queryKey: ['userProfile'],
        queryFn: async () => {
            const token = useAuthStore.getState().accessToken;
            if (!token) return null;
            const res = await axiosClient.get('/users/profile');
            const profile = res.data?.data;
            return profile
                ? { ...profile, avatarUrl: profile.avatarUrl ?? profile.avatar_url }
                : null;
        },
    });

    useEffect(() => {
        const handleUnauthorized = () => {
            queryClient.setQueryData(['userProfile'], null);
        };
        window.addEventListener('auth-unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
    }, [queryClient]);

    const handleLogout = () => {
        useAuthStore.getState().clearAccessToken();
        queryClient.setQueryData(['userProfile'], null);
        enqueueSnackbar('Logged out successfully!', { variant: 'info' });
        router.push('/');
    };
    
    const rawAvatarUrl = user?.avatarUrl;
    const avatarUrl = typeof rawAvatarUrl === 'string' ? rawAvatarUrl.trim() : '';
    const getProfileHref = () => {
        const role = user?.role?.toLowerCase();
        if (role === 'student') return '/student/profile';
        if (role === 'judge') return '/judge/profile';
        if (role === 'stakeholder') return '/stakeholder/profile';
        if (role === 'admin' || role === 'organizer') return '/organizer/profile';
        return '/home';
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
            <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
                {/* Logo */}
                {showLogo ? <Logo size='sm' href="/home" /> : <div />}

                {/* Center Navigation */}
                {customCenterContent ? (
                    <div className="flex flex-1 items-center justify-center overflow-x-auto mx-2 md:mx-4 scrollbar-none">
                        {customCenterContent}
                    </div>
                ) : null}

                {/* Right Actions */}
                <div className="flex items-center gap-4">
                    {isLoading ? (
                        <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
                    ) : user && !isError ? (
                        <div className="flex items-center gap-3">
                            {user.role === 'student' && <InvitationsMenu />}
                            <NotificationsMenu />
                            
                            <ThemeToggle />
                            {(user.role === 'admin' || user.role === 'organizer') && (
                                <Button
                                    asChild
                                    variant="soft"
                                    size="sm"
                                    className="hidden sm:flex h-9 rounded-full px-3 text-primary hover:bg-primary/15"
                                >
                                    <Link href={getRoleHomePath(user.role)}>
                                        <LayoutDashboard className="size-4 mr-1.5" />
                                        <span>Dashboard</span>
                                    </Link>
                                </Button>
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger className="flex items-center gap-3 rounded-2xl border border-transparent px-2 py-1.5 transition-colors hover:bg-muted outline-none ml-2 group">
                                    <div className="hidden flex-col items-end sm:flex pl-2 text-left">
                                        <span className="text-sm font-semibold text-foreground max-w-[150px] truncate">{user.name}</span>
                                        <span className="text-[11px] text-muted-foreground truncate">{user.email}</span>
                                    </div>
                                    <Avatar className="h-9 w-9 ring-2 ring-orange-500/30 overflow-hidden">
                                        {avatarUrl ? (
                                            <AvatarImage
                                                key={avatarUrl}
                                                src={avatarUrl}
                                                alt={user.name}
                                                referrerPolicy="no-referrer"
                                            />
                                        ) : null}

                                        <AvatarFallback className="bg-orange-500/15 text-sm font-bold text-orange-400">
                                            {user.name?.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:block transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </DropdownMenuTrigger>

                                <DropdownMenuContent
                                    align="end"
                                    className="w-60 border border-border bg-popover/95 backdrop-blur-xl p-2 rounded-xl shadow-xl"
                                >
                                    <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2">
                                        <Link href={`${getProfileHref()}?tab=info`} className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                            My Profile
                                        </Link>
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2">
                                        <Link href={`${getProfileHref()}?tab=history`} className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                            Participation History
                                        </Link>
                                    </DropdownMenuItem>



                                    <DropdownMenuSeparator className="my-2" />

                                    <DropdownMenuItem 
                                        className="text-red-500 focus:text-red-500 focus:bg-red-500/10 cursor-pointer rounded-lg py-2 flex items-center gap-2"
                                        onClick={handleLogout}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                                        Logout
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ) : (
                        <>
                            <ThemeToggle />
                            <Link href={"/login"}>
                                <Button variant="ghost" size="sm" className='text-sm text-muted-foreground hover:text-foreground'>
                                    Login
                                </Button>
                            </Link>
                            <Link href={"/register"}>
                                <Button size="sm" className="px-6">
                                    Register
                                </Button>
                            </Link>
                        </>
                    )}
                </div>
            </nav>
            {/* Soft top-to-bottom drop shadow */}
            <div className="absolute -bottom-4 left-0 right-0 h-4 bg-gradient-to-b from-foreground/[0.08] to-transparent pointer-events-none" />
        </header>
    );
}
