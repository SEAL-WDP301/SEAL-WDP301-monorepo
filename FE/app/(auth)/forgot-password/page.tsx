/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Loader2, Mail } from "lucide-react";
import { axiosClient } from "@/lib/axios";
import { enqueueSnackbar } from "notistack";

import { Button } from "@/components/ui/button";
import { AuthCard, AuthFooterLink, AuthHeader } from "../_components/auth-card";
import { AuthField } from "../_components/auth-controls";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address (e.g. name@fpt.edu.vn)"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [cooldown, setCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    if (cooldown > 0) return;

    try {
      const res = await axiosClient.post("/auth/forgot-password", values);
      enqueueSnackbar(res.data?.message || "Password reset instructions sent!", { variant: "success" });
      setCooldown(60);
    } catch (error: any) {
      const errMessage = error.response?.data?.message;
      const displayMessage = Array.isArray(errMessage) ? errMessage[0] : errMessage;

      enqueueSnackbar(
        displayMessage || "An error occurred. Please try again.",
        { variant: "error" }
      );
      if (error.response?.status === 429) {
        setCooldown(60);
      }
    }
  };

  return (
    <AuthCard>
      <div className="space-y-5">
        <AuthHeader
          title="Forgot Password"
          subtitle="Enter your registered email and we will send you password reset instructions."
        />

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <AuthField
            label="Email"
            type="email"
            placeholder="you@fpt.edu.vn"
            autoComplete="email"
            icon={<Mail className="size-4" />}
            error={errors.email?.message}
            {...register("email")}
          />

          <Button 
            variant="authPrimary" 
            size="auth" 
            className="w-full font-bold" 
            type="submit" 
            disabled={isSubmitting || cooldown > 0}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin mx-auto" />
            ) : cooldown > 0 ? (
              `Resend in (${cooldown}s)`
            ) : (
              <>Send Instructions <ArrowRight className="size-4" /></>
            )}
          </Button>
        </form>

        <Link href="/login" className="block">
          <Button variant="authSecondary" size="auth" type="button" className="mx-auto w-full font-medium sm:w-auto">
            <ArrowLeft className="size-4" />
            Back to Login
          </Button>
        </Link>

        <AuthFooterLink
          label="Don't have an account?"
          href="/register"
          action="Register now"
        />
      </div>
    </AuthCard>
  );
}
