"use client";

import { useEffect, type ReactNode, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { axiosClient } from "@/lib/axios";
import { useAuthStore, type UserProfile } from "@/lib/stores/auth.store";
import { queryKeys } from "@/lib/query-keys";

export type AppRole = "admin" | "organizer" | "student" | "stakeholder" | "judge";

interface RoleGuardProps {
  allowedRoles: AppRole[];
  children: ReactNode;
}

const roleHomePath: Record<AppRole, string> = {
  admin: "/organizer/dashboard",
  organizer: "/organizer/dashboard",
  student: "/home",
  stakeholder: "/home",
  judge: "/judge/events",
};

export function getRoleHomePath(role?: string) {
  const normalizedRole = role?.toLowerCase();
  return normalizedRole && normalizedRole in roleHomePath ? roleHomePath[normalizedRole as AppRole] : "/home";
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore(state => state.accessToken);

  // To avoid hydration mismatch if needed, we can use a small state, 
  // but Zustand handles it well. 
  // If undefined on server, we wait.
  const hasToken = accessToken ? true : false;
  // Let's use a mounted flag to wait for client
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const storeUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const {
    data: user,
    isLoading,
    isFetching,
    isError,
  } = useQuery<UserProfile | null>({
    queryKey: queryKeys.user,
    queryFn: async () => {
      const token = useAuthStore.getState().accessToken;
      if (!token) {
        setUser(null);
        return null;
      }

      const res = await axiosClient.get("/users/profile");
      const profile = res.data?.data ?? null;
      if (profile) setUser(profile);
      return profile;
    },
    initialData: storeUser || undefined,
    enabled: hasToken && mounted,
    staleTime: 60 * 1000,
  });

  const effectiveUser = user || storeUser;

  useEffect(() => {
    if (!mounted) return;

    if (!hasToken) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    // Only kick to login if profile fetch failed AND we have no cached user from sign-in
    if (isError && !storeUser) {
      router.replace("/login");
      return;
    }

    if (!isLoading && effectiveUser) {
      const role = effectiveUser.role?.toLowerCase();
      if (!role || !allowedRoles.includes(role as AppRole)) {
        router.replace(getRoleHomePath(role));
      }
    }
  }, [
    allowedRoles,
    effectiveUser,
    hasToken,
    isError,
    isLoading,
    mounted,
    pathname,
    router,
    storeUser,
  ]);

  if (!mounted || !hasToken || (isLoading && !effectiveUser) || (isError && !effectiveUser)) {
    return <RoleGuardFallback />;
  }

  const normalizedUserRole = effectiveUser?.role?.toLowerCase();
  if (!normalizedUserRole || !allowedRoles.includes(normalizedUserRole as AppRole)) {
    return <RoleGuardFallback />;
  }

  return <>{children}</>;
}

function RoleGuardFallback() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
        <Loader2 className="size-5 animate-spin text-primary" />
        Checking permissions...
      </div>
    </div>
  );
}
