"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, Mail, Shield } from "lucide-react";
import { isAxiosError } from "axios";
import { axiosClient } from "@/lib/axios";
import { useAuthStore } from "@/lib/stores/auth.store";
import { getRoleHomePath } from "@/components/auth/role-guard";
import { useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FaGithub } from "react-icons/fa";
import { queryKeys } from "@/lib/query-keys";

import {
  AuthCard,
  AuthDivider,
  AuthFooterLink,
  AuthHeader,
} from "../_components/auth-card";
import { Button } from "@/components/ui/button";
import { AuthField } from "../_components/auth-controls";
import { getOAuthUrl } from "@/lib/auth-oauth";

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "12345678",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axiosClient.post("/auth/signin", formData);

      // Save token & user profile
      if (res.data?.data?.accessToken) {
        console.log("[DEV] Logged in successfully. Access Token:", res.data.data.accessToken);
        setAccessToken(res.data.data.accessToken);
        if (res.data.data.refreshToken) {
          useAuthStore.getState().setRefreshToken(res.data.data.refreshToken);
        }
        if (res.data.data.user) {
          useAuthStore.getState().setUser(res.data.data.user);
        }
      }

      enqueueSnackbar("Đăng nhập thành công!", { variant: "success" });

      // Update global user state cache
      queryClient.invalidateQueries({ queryKey: queryKeys.user });

      const role = res.data?.data?.user?.role;
      const redirectTo = getSafeRedirectPath(
        new URLSearchParams(window.location.search).get("redirect")
      );

      if (redirectTo) {
        router.push(redirectTo);
        return;
      }

      router.push(getRoleHomePath(role));
    } catch (error: unknown) {
      enqueueSnackbar(
        isAxiosError<{ message?: string }>(error)
          ? error.response?.data?.message || "Đăng nhập thất bại. Vui lòng thử lại."
          : "Đăng nhập thất bại. Vui lòng thử lại.",
        { variant: "error" }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <div className="space-y-5">
        <AuthHeader
          title="Welcome back"
          subtitle="Sign in to continue to the SEAL command center."
        />

        <form className="space-y-4" onSubmit={handleSubmit}>
          <AuthField
            label="Email"
            name="email"
            type="email"
            placeholder="you@fpt.edu.vn"
            autoComplete="email"
            icon={<Mail className="size-4" />}
            value={formData.email}
            onChange={handleChange}
            required
          />
          <AuthField
            label="Password"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            icon={<Shield className="size-4" />}
            value={formData.password}
            onChange={handleChange}
            required
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground sm:text-sm">
            <label className="flex items-center gap-3">
              <span className="grid size-5 place-items-center rounded-md border border-border bg-muted text-primary">
                <Check className="size-4" />
              </span>
              Remember me
            </label>
            <Link href="/forgot-password" className="hover:text-primary">
              Forgot password?
            </Link>
          </div>

          <Button variant="authPrimary" size="auth" className="w-full font-bold" type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin mx-auto" />
            ) : (
              <>Login <ArrowRight className="size-4" /></>
            )}
          </Button>
        </form>

        <AuthDivider />

        <div className="grid gap-2 sm:grid-cols-2">
          <a href={getOAuthUrl("google")} className="block w-full">
            <Button variant="authSecondary" size="auth" type="button" className="w-full font-medium">
              <span className="text-lg font-semibold">G</span>
              Google
            </Button>
          </a>
          <a href={getOAuthUrl("github")} className="block w-full">
            <Button variant="authSecondary" size="auth" type="button" className="w-full font-medium">
              <FaGithub className="size-4" />
              GitHub
            </Button>
          </a>
        </div>

        <AuthFooterLink
          label="Don't have an account?"
          href="/register"
          action="Register"
        />
      </div>
    </AuthCard>
  );
}

function getSafeRedirectPath(path: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}
