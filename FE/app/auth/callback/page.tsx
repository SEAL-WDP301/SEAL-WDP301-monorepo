"use client";

import { useEffect, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { enqueueSnackbar } from "notistack";
import { axiosClient } from "@/lib/axios";
import { getRoleHomePath } from "@/components/auth/role-guard";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth.store";
import { queryKeys } from "@/lib/query-keys";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    const refreshToken = searchParams.get("refreshToken");

    if (token) {
      setAccessToken(token);
      if (refreshToken) {
        useAuthStore.getState().setRefreshToken(refreshToken);
      }
      axiosClient.get("/users/profile")
      .then(res => {
        const user = res.data?.data;
        if (!user) throw new Error("Invalid user data");
        
        // Show success snackbar
        enqueueSnackbar(
          <div className="flex items-center gap-3">
            {user.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt="Avatar" 
                className="size-8 rounded-full border border-border object-cover" 
              />
            ) : (
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/20 text-primary font-bold">
                {user.name.charAt(0)}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">Đăng nhập thành công!</span>
              <span className="text-xs text-muted-foreground">Chào mừng {user.name}</span>
            </div>
          </div>,
          { variant: "default", preventDuplicate: true }
        );

        // Set user in Zustand store
        useAuthStore.getState().setUser(user);

        queryClient.setQueryData(queryKeys.user, user);
        queryClient.invalidateQueries({ queryKey: queryKeys.user });

        setTimeout(() => {
          router.push(getRoleHomePath(user.role));
        }, 1000);
      })
      .catch(err => {
        console.error(err);
        enqueueSnackbar("Lỗi khi lấy thông tin người dùng", { variant: "error" });
        router.push("/");
      });

    } else {
      enqueueSnackbar("Đăng nhập thất bại. Không tìm thấy token.", { variant: "error" });
      router.push("/login");
    }
  }, [router, searchParams]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center space-y-4 bg-background text-foreground">
      <Loader2 className="size-10 animate-spin text-primary" />
      <p className="text-sm font-medium tracking-wide text-muted-foreground">
        Authenticating...
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full flex-col items-center justify-center space-y-4 bg-background text-foreground">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-sm font-medium tracking-wide text-muted-foreground">
            Loading...
          </p>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
