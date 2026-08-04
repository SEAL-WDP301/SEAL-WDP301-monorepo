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

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
      .regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
      .regex(/[0-9]/, "Password must contain at least 1 number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const watchNewPassword = watch("newPassword");
  const watchConfirmPassword = watch("confirmPassword");

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!token) {
      enqueueSnackbar("Reset token not found. Please request a new link.", { variant: "error" });
      return;
    }

    try {
      const res = await axiosClient.post("/auth/reset-password", {
        token,
        newPassword: values.newPassword,
      });
      enqueueSnackbar(res.data?.message || "Password changed successfully!", { variant: "success" });
      router.push("/login");
    } catch (error: any) {
      const errMessage = error.response?.data?.message;
      const displayMessage = Array.isArray(errMessage) ? errMessage[0] : errMessage;

      enqueueSnackbar(
        displayMessage || "Token has expired or is invalid.",
        { variant: "error" }
      );
    }
  };

  if (!token) {
    return (
      <AuthCard>
        <div className="space-y-5">
          <AuthHeader
            title="Invalid Reset Link"
            subtitle="No password reset token was found. Please return to the Forgot Password page to request a new link."
          />
          <Link href="/forgot-password" className="block">
            <Button variant="authSecondary" size="auth" type="button" className="mx-auto w-full font-medium sm:w-auto">
              <ArrowLeft className="size-4" />
              Request New Link
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
          title="Reset Password"
          subtitle="Please enter your new password below."
        />

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <AuthField
            label="New Password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register("newPassword")}
          />

          <AuthField
            label="Confirm Password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            hideToggle
            rightIcon={
              watchConfirmPassword && watchConfirmPassword.length > 0 ? (
                watchNewPassword === watchConfirmPassword ? (
                  <CheckCircle2 className="size-5 text-green-500" />
                ) : (
                  <XCircle className="size-5 text-red-500" />
                )
              ) : null
            }
            {...register("confirmPassword")}
          />

          <Button
            variant="authPrimary"
            size="auth"
            className="w-full font-bold"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin mx-auto" />
            ) : (
              <>Reset Password <ArrowRight className="size-4" /></>
            )}
          </Button>
        </form>

        <Link href="/login" className="block">
          <Button variant="authSecondary" size="auth" type="button" className="mx-auto w-full font-medium sm:w-auto">
            <ArrowLeft className="size-4" />
            Back to Login
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
