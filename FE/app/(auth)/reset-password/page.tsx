/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { axiosClient } from "@/lib/axios";
import { enqueueSnackbar } from "notistack";

import { Button } from "@/components/ui/button";
import { AuthCard, AuthHeader } from "../_components/auth-card";
import { AuthField } from "../_components/auth-controls";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!token) {
      enqueueSnackbar("Không tìm thấy mã xác thực. Vui lòng yêu cầu lại link khôi phục.", { variant: "error" });
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      enqueueSnackbar("Mật khẩu xác nhận không khớp!", { variant: "warning" });
      return;
    }

    setLoading(true);

    try {
      const res = await axiosClient.post("/auth/reset-password", {
        token,
        newPassword: formData.newPassword
      });
      enqueueSnackbar(res.data?.message || "Đổi mật khẩu thành công!", { variant: "success" });
      router.push("/login");
    } catch (error: any) {
      const errMessage = error.response?.data?.message;
      const displayMessage = Array.isArray(errMessage) ? errMessage[0] : errMessage;

      enqueueSnackbar(
        displayMessage || "Mã xác thực đã hết hạn hoặc không hợp lệ.",
        { variant: "error" }
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthCard>
        <div className="space-y-5">
          <AuthHeader
            title="Liên kết không hợp lệ"
            subtitle="Không tìm thấy mã khôi phục mật khẩu. Vui lòng quay lại trang Quên mật khẩu để yêu cầu lại."
          />
          <Link href="/forgot-password" className="block">
            <Button variant="authSecondary" size="auth" type="button" className="mx-auto w-full font-medium sm:w-auto">
              <ArrowLeft className="size-4" />
              Yêu cầu link mới
            </Button>
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div className="space-y-5">
        <AuthHeader
          title="Tạo mật khẩu mới"
          subtitle="Vui lòng nhập mật khẩu mới của bạn bên dưới."
        />

        <form className="space-y-4" onSubmit={handleSubmit}>
          <AuthField
            label="Mật khẩu mới"
            name="newPassword"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            value={formData.newPassword}
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
                formData.newPassword === formData.confirmPassword ? (
                  <CheckCircle2 className="size-5 text-green-500" />
                ) : (
                  <XCircle className="size-5 text-red-500" />
                )
              ) : null
            }
          />

          <Button
            variant="authPrimary"
            size="auth"
            className="w-full font-bold"
            type="submit"
            disabled={loading || !formData.newPassword || formData.newPassword !== formData.confirmPassword}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin mx-auto" />
            ) : (
              <>Đổi mật khẩu <ArrowRight className="size-4" /></>
            )}
          </Button>
        </form>

        <Link href="/login" className="block">
          <Button variant="authSecondary" size="auth" type="button" className="mx-auto w-full font-medium sm:w-auto">
            <ArrowLeft className="size-4" />
            Quay lại trang Đăng nhập
          </Button>
        </Link>
      </div>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <AuthCard>
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </AuthCard>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
