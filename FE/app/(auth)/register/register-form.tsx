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

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name is too long"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
      .regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
      .regex(/[0-9]/, "Password must contain at least 1 number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm({
  initialEmail = "",
  redirectPath = "",
}: {
  initialEmail?: string;
  redirectPath?: string;
}) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: initialEmail,
      password: "",
      confirmPassword: "",
    },
  });

  const watchPassword = watch("password");
  const watchConfirmPassword = watch("confirmPassword");

  async function onSubmit(values: RegisterFormValues) {
    try {
      const res = await axiosClient.post("/auth/signup", {
        fullName: values.fullName,
        email: values.email,
        password: values.password,
      });

      enqueueSnackbar(res.data?.message || "Registration successful!", { variant: "success" });
      const params = new URLSearchParams({ email: values.email });
      if (redirectPath.startsWith("/") && !redirectPath.startsWith("//")) {
        params.set("redirect", redirectPath);
      }
      router.push(`/verify-email?${params.toString()}`);
    } catch (error: unknown) {
      const errMessage = isAxiosError<{ message?: string | string[] }>(error)
        ? error.response?.data?.message
        : undefined;
      const displayMessage = Array.isArray(errMessage) ? errMessage[0] : errMessage;
      
      enqueueSnackbar(
        displayMessage || "Registration failed. Please try again.",
        { variant: "error" }
      );
    }
  }

  return (
    <AuthCard>
      <div className="space-y-5">
        <AuthHeader
          title="Create New Account"
          subtitle="The first step to join the competition."
        />

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <AuthField 
              label="Full Name" 
              placeholder="Nguyen Van A" 
              autoComplete="name" 
              error={errors.fullName?.message}
              {...register("fullName")}
            />
            <AuthField
              label="Email"
              type="email"
              placeholder="you@email.com"
              autoComplete="email"
              readOnly={Boolean(initialEmail)}
              error={errors.email?.message}
              {...register("email")}
            />
            <AuthField
              label="Password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register("password")}
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
                  watchPassword === watchConfirmPassword ? (
                    <CheckCircle2 className="size-5 text-green-500" />
                  ) : (
                    <XCircle className="size-5 text-red-500" />
                  )
                ) : null
              }
              {...register("confirmPassword")}
            />
          </div>

          <div className="pt-4 flex justify-center">
            <Button
              variant="authPrimary"
              size="auth"
              className="w-full min-w-[200px] font-bold sm:w-auto"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin mx-auto" />
              ) : (
                <>Register <ArrowRight className="size-4" /></>
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
