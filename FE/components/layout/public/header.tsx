"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '@/lib/axios';
import { enqueueSnackbar } from 'notistack';
import { useEffect } from 'react';
import { LayoutDashboard, LogOut } from 'lucide-react';

import Logo from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '../dashboard/theme-toggle';
import { getRoleHomePath } from '@/components/auth/role-guard';
import { useAuthStore } from '@/lib/stores/auth.store';
import { queryKeys } from '@/lib/query-keys';

export default function Navigation() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const storeUser = useAuthStore((state) => state.user);
    const setUser = useAuthStore((state) => state.setUser);

    const { data: user, isLoading, isError } = useQuery({
        queryKey: queryKeys.user,
        queryFn: async () => {
            const token = useAuthStore.getState().accessToken;
            if (!token) {
                setUser(null);
                return null;
            }
            const res = await axiosClient.get('/users/profile');
            const profile = res.data?.data;
            const normalized = profile
                ? { ...profile, avatarUrl: profile.avatarUrl ?? profile.avatar_url }
                : null;
            setUser(normalized);
            return normalized;
        },
        initialData: storeUser ? { ...storeUser, avatarUrl: storeUser.avatarUrl ?? storeUser.avatar_url } : undefined,
    });

    useEffect(() => {
        const handleUnauthorized = () => {
            setUser(null);
            queryClient.setQueryData(queryKeys.user, null);
        };
        window.addEventListener('auth-unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
    }, [queryClient, setUser]);

    const handleLogout = () => {
        useAuthStore.getState().clearAccessToken();
        queryClient.setQueryData(queryKeys.user, null);
        enqueueSnackbar('Logged out successfully!', { variant: 'info' });
        router.push('/');
    };

    const navItems = [
        { label: 'Home', href: '/' },
        { label: 'Stakeholder', href: '#stakeholder' },
        { label: 'Categories', href: '#categories' },
        { label: 'About', href: '#about' },
        { label: 'FAQ', href: '#FAQ' }
    ];
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
            <nav className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">

                {/* Logo */}
                <div className="shrink-0">
                    <Logo size='sm' />
                </div>

                {/* Navigation */}
                <nav className="hidden items-center rounded-full border border-border bg-card/70 p-1 shadow-sm backdrop-blur-xl lg:flex">
                    {navItems.map((item) => (
                        <Link
                            key={item.label}
                            href={item.href}
                            className="group relative rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-300 hover:text-foreground xl:px-4"
                        >
                            {/* Hover Background */}
                            <span className="absolute inset-0 rounded-full bg-orange-500/0 transition-all duration-300 group-hover:bg-orange-500/10" />

                            {/* Text */}
                            <span className="relative z-10">
                                {item.label}
                            </span>
                        </Link>
                    ))}
                </nav>

                {/* Right Actions */}
                <div className="flex shrink-0 items-center gap-2">
                    {isLoading ? (
                        <div className="h-9 w-32 animate-pulse rounded-full bg-muted" />
                    ) : user && !isError ? (
                        <>
                            <ThemeToggle />

                            <Button
                                asChild
                                variant="soft"
                                size="lg"
                                className="h-9 rounded-full px-3 text-primary hover:bg-primary/15 sm:px-4"
                            >
                                <Link href={getRoleHomePath(user.role)}>
                                    <LayoutDashboard className="size-4" />
                                    <span className="hidden sm:inline">Dashboard</span>
                                </Link>
                            </Button>

                            <div className="hidden items-center gap-3 rounded-full border border-border bg-card/70 py-1 pr-1 pl-4 xl:flex">
                                <div className="max-w-36 text-right leading-tight">
                                    <p className="truncate text-sm font-semibold text-foreground">
                                        {user.name}
                                    </p>
                                    <p className="truncate text-[11px] text-muted-foreground">
                                        {user.email}
                                    </p>
                                </div>
                                <Link href={getProfileHref()} className="transition-transform hover:scale-105">
                                    <Avatar className="h-8 w-8 ring-2 ring-orange-500/20">
                                        {avatarUrl ? (
                                            <AvatarImage
                                                key={avatarUrl}
                                                src={avatarUrl}
                                                alt={user.name}
                                                referrerPolicy="no-referrer"
                                            />
                                        ) : null}
                                        <AvatarFallback>
                                            {user.name?.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </Link>
                            </div>

                            <Link href={getProfileHref()} className="transition-transform hover:scale-105 xl:hidden">
                                <Avatar className="h-9 w-9 ring-2 ring-orange-500/20">
                                    {avatarUrl ? (
                                        <AvatarImage
                                            key={avatarUrl}
                                            src={avatarUrl}
                                            alt={user.name}
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : null}

                                    <AvatarFallback>
                                        {user.name?.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            </Link>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleLogout}
                                title="Logout"
                                aria-label="Logout"
                                className="rounded-full text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                            >
                                <LogOut className="size-4" />
                            </Button>
                        </>
                    ) : (
                        <>
                            <ThemeToggle />
                            <Button asChild variant="ghost" size="lg" className="h-9 rounded-full px-4">
                                <Link href={"/login"}>
                                    Login
                                </Link>
                            </Button>
                            <Button asChild size="lg" className="h-9 rounded-full px-5">
                                <Link href={"/register"}>
                                    Register
                                </Link>
                            </Button>
                        </>
                    )}
                </div>
            </nav>
        </header>
    );
}
