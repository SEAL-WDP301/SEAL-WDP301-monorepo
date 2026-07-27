"use client";

import { useState } from "react";
import { ArrowRight, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { FaGithub } from "react-icons/fa";

import { Button } from "@/components/ui/button";
import { AuthCard, AuthDivider, AuthFooterLink, AuthHeader } from "../_components/auth-card";
import { AuthField } from "../_components/auth-controls";
import { axiosClient } from "@/lib/axios";
import { enqueueSnackbar } from "notistack";
import { getOAuthUrl } from "@/lib/auth-oauth";

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      enqueueSnackbar("Mật khẩu xác nhận không khớp!", { variant: "error" });
      return;
    }

    setLoading(true);
    try {
      const res = await axiosClient.post("/auth/signup", {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
      });

      enqueueSnackbar(res.data?.message || "Đăng ký thành công!", { variant: "success" });
      router.push(`/verify-email?email=${encodeURIComponent(formData.email)}`);
    } catch (error: unknown) {
      const errMessage = isAxiosError<{ message?: string | string[] }>(error)
        ? error.response?.data?.message
        : undefined;
      const displayMessage = Array.isArray(errMessage) ? errMessage[0] : errMessage;
      
      enqueueSnackbar(
        displayMessage || "Lỗi đăng ký. Vui lòng thử lại.",
        { variant: "error" }
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard>
      <div className="space-y-5">
        <AuthHeader
          title="Tạo tài khoản mới"
          subtitle="Bước đầu tiên để tham gia giải đấu."
        />

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <AuthField 
              label="Họ và tên" 
              name="fullName"
              placeholder="Nguyễn Văn A" 
              autoComplete="name" 
              value={formData.fullName}
              onChange={handleChange}
              required
            />
            <AuthField
              label="Email"
              name="email"
              type="email"
              placeholder="you@email.com"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <AuthField
              label="Mật khẩu"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={8}
            />
            <AuthField
              label="Xác nhận mật khẩu"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              minLength={8}
              hideToggle
              rightIcon={
                formData.confirmPassword.length > 0 ? (
                  formData.password === formData.confirmPassword ? (
                    <CheckCircle2 className="size-5 text-green-500" />
                  ) : (
                    <XCircle className="size-5 text-red-500" />
                  )
                ) : null
              }
            />
          </div>

          <div className="pt-4 flex justify-center">
            <Button
              variant="authPrimary"
              size="auth"
              className="w-full min-w-[200px] font-bold sm:w-auto"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin mx-auto" />
              ) : (
                <>Đăng ký <ArrowRight className="size-4" /></>
              )}
            </Button>
          </div>
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
          label="Đã có tài khoản?"
          href="/login"
          action="Đăng nhập"
        />
      </div>
    </AuthCard>
  );
}
